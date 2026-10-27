"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { passkeyRegistrataQui, segnaPasskeyRegistrataQui } from "@/lib/passkey-locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/* Numero italiano scritto come capita → E.164 (+39…). */
export function normalizzaTelefono(raw: string): string | null {
  const s = raw.replace(/[\s().-]/g, "");
  if (/^\+39\d{9,10}$/.test(s)) return s;
  if (/^0039\d{9,10}$/.test(s)) return "+" + s.slice(2);
  if (/^3\d{8,9}$/.test(s)) return "+39" + s;
  if (/^\+\d{8,15}$/.test(s)) return s;   // estero
  return null;
}

export function AccessoForm() {
  const router = useRouter();
  const [fase, setFase] = useState<"telefono" | "codice">("telefono");
  const [telefono, setTelefono] = useState("");
  const [codice, setCodice] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  // "qui": su questo dispositivo è già stata registrata una passkey → la si propone per prima.
  // "altrove": il browser la supporta ma qui non ce n'è → prima il codice SMS, la passkey resta un link.
  const [passkey, setPasskey] = useState<"no" | "qui" | "altrove">("no");
  const [pending, start] = useTransition();

  useEffect(() => {
    // Deciso dopo l'idratazione, fuori dal corpo dell'effetto.
    const t = setTimeout(() => setPasskey(!("PublicKeyCredential" in window) ? "no" : passkeyRegistrataQui() ? "qui" : "altrove"), 0);
    return () => clearTimeout(t);
  }, []);

  const entrato = () => { router.replace("/"); router.refresh(); };

  const inviaCodice = () => {
    setErrore(null);
    const tel = normalizzaTelefono(telefono);
    if (!tel) { setErrore("Scrivi il numero di cellulare, ad esempio 333 123 4567."); return; }
    start(async () => {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithOtp({ phone: tel, options: { channel: "sms" } });
      if (error) { setErrore(messaggio(error.message)); return; }
      setTelefono(tel);
      setFase("codice");
    });
  };

  const verificaCodice = () => {
    setErrore(null);
    const token = codice.replace(/\D/g, "");
    if (token.length !== 6) { setErrore("Il codice ha 6 cifre."); return; }
    start(async () => {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.verifyOtp({ phone: telefono, token, type: "sms" });
      if (error) { setErrore(messaggio(error.message)); return; }
      entrato();
    });
  };

  const conPasskey = () => {
    setErrore(null);
    start(async () => {
      try {
        const { error } = await supabaseBrowser().auth.signInWithPasskey();
        if (error) { setErrore(messaggio(error.message)); return; }
        segnaPasskeyRegistrataQui(true);
        entrato();
      } catch (e) {
        // L'utente ha annullato o il dispositivo non ha passkey registrate: si torna al codice.
        setErrore(e instanceof Error && /abort|cancel|NotAllowed/i.test(e.message) ? null : "Passkey non disponibile su questo dispositivo: usa il codice via SMS.");
      }
    });
  };

  return (
    <div className="mt-6 flex w-full flex-col gap-3.5">
      {passkey === "qui" && (
        <>
          <Button size="lg" className="w-full" onClick={conPasskey} disabled={pending}>
            <Fingerprint size={22} /> Entra con la passkey
          </Button>
          <p className="text-center text-[13px] text-muted-foreground">Usa lo sblocco del telefono: impronta o Face ID. Niente password da ricordare.</p>
          <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[.06em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />oppure<span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      {fase === "telefono" ? (
        <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); inviaCodice(); }}>
          <Field>
            <FieldLabel htmlFor="tel">Numero di cellulare</FieldLabel>
            <Input id="tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="+39 3xx xxx xxxx" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Field>
          <Button type="submit" variant={passkey === "qui" ? "outline" : "default"} size="lg" className="w-full" disabled={pending}>
            {pending ? "Invio in corso…" : "Ricevi un codice via SMS"}
          </Button>
          {passkey === "altrove" && (
            <p className="text-center text-[13px] text-muted-foreground">
              Prima volta su questo dispositivo? Si entra con il codice; la passkey si attiva dopo, dal Profilo.{" "}
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-[13px]" onClick={conPasskey} disabled={pending}>Ne hai già una? Usala</Button>
            </p>
          )}
        </form>
      ) : (
        <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); verificaCodice(); }}>
          <Alert variant="success">
            <ShieldCheck />
            <AlertTitle>Codice inviato a {telefono}</AlertTitle>
            <AlertDescription>Arriva via SMS in pochi secondi e vale 5 minuti.</AlertDescription>
          </Alert>
          <Field>
            <FieldLabel htmlFor="otp">Codice a 6 cifre</FieldLabel>
            <Input id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} placeholder="••••••" className="text-center text-2xl tracking-[.4em]"
              value={codice} onChange={(e) => setCodice(e.target.value)} autoFocus />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Verifica…" : "Entra"}</Button>
          <Button type="button" variant="link" className="text-muted-foreground" onClick={() => { setFase("telefono"); setCodice(""); }}>
            Numero sbagliato? Cambialo
          </Button>
        </form>
      )}

      {errore && <Alert variant="destructive"><AlertDescription>{errore}</AlertDescription></Alert>}

      <p className="mt-4 text-center text-[13px] text-muted-foreground">
        Prima volta qui? L&apos;iscrizione dei bambini si fa dall&apos;app dopo il primo accesso.
      </p>
    </div>
  );
}

function messaggio(m: string) {
  if (/rate limit|too many/i.test(m)) return "Troppi tentativi: aspetta un minuto e riprova.";
  if (/invalid|expired/i.test(m) && /token|otp/i.test(m)) return "Codice sbagliato o scaduto. Chiedine uno nuovo.";
  if (/sms|phone/i.test(m) && /not enabled|disabled/i.test(m)) return "L'accesso via SMS non è ancora attivo su questo progetto.";
  return m;
}
