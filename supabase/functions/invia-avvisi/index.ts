// =============================================================================
// Pedibus · invia-avvisi
// Svuota la coda degli avvisi: push a ogni abbonamento della persona; SMS sempre
// per gli urgenti (avvisi.sms = true) e come ripiego, se l'impostazione
// sms_ripiego è attiva, per chi non ha nessun abbonamento push.
// Chiamata dal database (trigger pg_net all'inserimento, cron ogni 2 minuti) o a
// mano. Autenticazione: header x-pedibus-secret = PEDIBUS_CRON_SECRET.
//
// Variabili d'ambiente (supabase secrets set …):
//   PEDIBUS_CRON_SECRET      segreto condiviso con impostazioni.invia_avvisi_secret
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT   (npx web-push generate-vapid-keys)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM   (FROM: mittente alfanumerico "PEDIBUS" o numero)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY              (forniti dalla piattaforma)
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Avviso = {
  id: number; destinatario_id: string; tipo: string; titolo: string; corpo: string;
  sms: boolean; linea_id: string | null; turno_id: string | null; creato_il: string;
  push_esito: string | null; sms_esito: string | null; tentativi: number;
};
type Abbonamento = { id: string; endpoint: string; p256dh: string; auth: string };

const env = (k: string, obbligatoria = true) => {
  const v = Deno.env.get(k);
  if (!v && obbligatoria) throw new Error(`Manca la variabile ${k}`);
  return v ?? "";
};

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const vapidPronto = !!(env("VAPID_PUBLIC_KEY", false) && env("VAPID_PRIVATE_KEY", false));
if (vapidPronto) {
  webpush.setVapidDetails(env("VAPID_SUBJECT", false) || "mailto:pedibus@officinacivica.it", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
}
const twilioPronto = !!(env("TWILIO_ACCOUNT_SID", false) && env("TWILIO_AUTH_TOKEN", false) && env("TWILIO_FROM", false));

// Il testo dell'SMS: titolo + corpo, in un segmento GSM-7 quando possibile (160 caratteri).
function testoSms(a: Avviso): string {
  const t = `Pedibus: ${a.titolo}. ${a.corpo}`.replace(/[«»"]/g, "").replace(/\s+/g, " ").trim();
  return t.length <= 160 ? t : t.slice(0, 157) + "…";
}

async function inviaSms(a: Avviso, telefono: string): Promise<string> {
  if (!twilioPronto) return "errore: Twilio non configurato";
  const sid = env("TWILIO_ACCOUNT_SID"), token = env("TWILIO_AUTH_TOKEN");
  const body = new URLSearchParams({ To: telefono, From: env("TWILIO_FROM"), Body: testoSms(a) });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${token}`), "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (r.status === 201) return "inviato";
  const err = await r.text().catch(() => "");
  return `errore: Twilio ${r.status} ${err.slice(0, 120)}`;
}

async function inviaPush(a: Avviso, abbonamenti: Abbonamento[]): Promise<string> {
  if (!abbonamenti.length) return "nessun_abbonamento";
  if (!vapidPronto) return "errore: VAPID non configurato";
  const payload = JSON.stringify({
    title: a.titolo, body: a.corpo, tag: `avviso-${a.id}`,
    data: { id: a.id, tipo: a.tipo, linea_id: a.linea_id, turno_id: a.turno_id, url: "/avvisi" },
  });
  let ok = 0; const morti: string[] = []; let ultimoErrore = "";
  for (const ab of abbonamenti) {
    try {
      await webpush.sendNotification(
        { endpoint: ab.endpoint, keys: { p256dh: ab.p256dh, auth: ab.auth } },
        payload,
        { TTL: a.sms ? 3600 : 6 * 3600, urgency: a.sms ? "high" : "normal" },
      );
      ok++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 0;
      if (status === 404 || status === 410) morti.push(ab.id);   // abbonamento scaduto o revocato
      else ultimoErrore = `errore: push ${status || (e as Error).message}`;
    }
  }
  if (morti.length) {
    await supabase.from("push_abbonamenti").update({ fallito_il: new Date().toISOString() }).in("id", morti);
  }
  if (ok > 0) {
    await supabase.from("push_abbonamenti").update({ ultimo_uso: new Date().toISOString() })
      .in("id", abbonamenti.filter((x) => !morti.includes(x.id)).map((x) => x.id));
    return "inviato";
  }
  return morti.length === abbonamenti.length ? "nessun_abbonamento" : (ultimoErrore || "errore: push");
}

Deno.serve(async (req) => {
  if (req.headers.get("x-pedibus-secret") !== env("PEDIBUS_CRON_SECRET")) {
    return new Response("non autorizzato", { status: 401 });
  }

  const { data: imp } = await supabase.from("impostazioni").select("chiave, valore");
  const smsRipiego = (imp ?? []).find((r) => r.chiave === "sms_ripiego")?.valore === "true";

  // La coda: non ancora spinto, o urgente senza SMS; non più vecchio di un giorno; backoff rispettato.
  const { data: coda, error } = await supabase
    .from("avvisi")
    .select("id, destinatario_id, tipo, titolo, corpo, sms, linea_id, turno_id, creato_il, push_esito, sms_esito, tentativi")
    .or("push_esito.is.null,and(sms.eq.true,sms_esito.is.null)")
    .gt("creato_il", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .lt("tentativi", 10)
    .or(`prossimo_tentativo.is.null,prossimo_tentativo.lte.${new Date().toISOString()}`)
    .order("creato_il", { ascending: true })
    .limit(200);
  if (error) return Response.json({ errore: error.message }, { status: 500 });
  if (!coda?.length) return Response.json({ inviati: 0 });

  const persone = [...new Set(coda.map((a) => a.destinatario_id))];
  const [{ data: abbs }, { data: tel }] = await Promise.all([
    supabase.from("push_abbonamenti").select("id, persona_id, endpoint, p256dh, auth").in("persona_id", persone).is("fallito_il", null),
    supabase.from("persone").select("id, telefono").in("id", persone),
  ]);
  const abbonamentiDi = (p: string) => (abbs ?? []).filter((x) => x.persona_id === p);
  const telefonoDi = (p: string) => (tel ?? []).find((x) => x.id === p)?.telefono ?? null;

  let push = 0, sms = 0, errori = 0;
  for (const a of coda as Avviso[]) {
    const esito: Partial<Avviso> & { prossimo_tentativo?: string | null } = { tentativi: a.tentativi + 1 };

    if (a.push_esito === null) {
      esito.push_esito = await inviaPush(a, abbonamentiDi(a.destinatario_id));
      if (esito.push_esito === "inviato") push++;
    }
    const pushEsito = esito.push_esito ?? a.push_esito;

    // SMS: sempre se urgente; altrimenti solo come ripiego per chi non ha push.
    if (a.sms_esito === null) {
      const senzaPush = pushEsito === "nessun_abbonamento";
      if (a.sms || (smsRipiego && senzaPush)) {
        const telefono = telefonoDi(a.destinatario_id);
        esito.sms_esito = telefono ? await inviaSms(a, telefono) : "nessun_telefono";
        if (esito.sms_esito === "inviato") sms++;
      } else {
        esito.sms_esito = "non_richiesto";
      }
    }

    const fallito = (esito.push_esito ?? "").startsWith("errore") || (esito.sms_esito ?? "").startsWith("errore");
    if (fallito) {
      errori++;
      // Un errore non blocca la coda: si riprova con attesa crescente (2, 4, 8 … minuti).
      esito.prossimo_tentativo = new Date(Date.now() + Math.min(60, 2 ** esito.tentativi!) * 60 * 1000).toISOString();
      if ((esito.push_esito ?? "").startsWith("errore")) esito.push_esito = null;
      if ((esito.sms_esito ?? "").startsWith("errore")) esito.sms_esito = null;
    }
    await supabase.from("avvisi").update(esito).eq("id", a.id);
  }
  return Response.json({ in_coda: coda.length, push, sms, errori });
});
