import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessione, nomeCompleto } from "@/lib/sessione";
import { Card } from "@/components/ui/card";
import { Avatar, H2, Row, Rows } from "@/components/blocchi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { iniziali } from "@/lib/utils";
import { esci } from "@/app/(app)/azioni";
import { Notifiche } from "./notifiche";
import { Passkey } from "./passkey";
import { Disponibilita } from "./disponibilita";
import { Backup } from "./backup";
import { Canali } from "./canali";
import { Amministratori } from "./amministratori";
import { getCanali } from "@/lib/canali";
import { BriefcaseMedical } from "lucide-react";
import { oggiRome } from "@/lib/date";

export const metadata: Metadata = { title: "Profilo" };

const RUOLO: Record<string, string> = { genitore: "Genitore principale", volontario: "Volontario civico", admin: "Amministratore" };

export default async function ProfiloPage() {
  const s = await getSessione();
  const supabase = await supabaseServer();
  const [{ data: bambini }, { data: iscrizioni }, { data: deleghe }, { data: contatti }, { data: abbonamenti }, canali] = await Promise.all([
    supabase.from("bambini").select("*").eq("genitore_id", s.userId).order("nome"),
    supabase.from("iscrizioni").select("*"),
    supabase.from("deleghe").select("*").eq("genitore_id", s.userId),
    supabase.from("contatti_emergenza").select("*, bambini!inner(genitore_id)").eq("bambini.genitore_id", s.userId).order("ordine"),
    supabase.from("push_abbonamenti").select("id, endpoint, user_agent, creato_il, fallito_il").eq("persona_id", s.userId),
    getCanali(),
  ]);
  const ids = [...new Set((iscrizioni ?? []).map((i) => i.linea_id))];
  const { data: linee } = ids.length ? await supabase.from("linee").select("id, nome").in("id", ids) : { data: [] };
  const { data: fermate } = await supabase.from("fermate").select("id, ordine").in("id", (iscrizioni ?? []).map((i) => i.fermata_id));
  const { data: delegati } = deleghe?.length ? await supabase.from("persone").select("id, nome, cognome, telefono").in("id", deleghe.map((d) => d.delegato_id)) : { data: [] };
  const informativa = (await supabase.from("informative").select("*").order("valida_dal", { ascending: false }).limit(1)).data?.[0];

  const volontario = s.ruoli.some((r) => r.ruolo === "volontario");
  const prossimoMese = new Date(oggiRome().slice(0, 7) + "-01T12:00:00"); prossimoMese.setMonth(prossimoMese.getMonth() + 1);
  const meseIso = prossimoMese.toISOString().slice(0, 10);
  const [{ data: disp }, { data: ecc }, { data: dotazioni }, { data: chiusure }, { data: bozze }] = volontario ? await Promise.all([
    supabase.from("disponibilita").select("giorno").eq("volontario_id", s.userId),
    supabase.from("eccezioni_disponibilita").select("giorno, tipo").eq("volontario_id", s.userId).gte("giorno", meseIso),
    supabase.from("dotazioni").select("*").eq("volontario_id", s.userId).is("restituita_il", null),
    supabase.from("calendario_chiusure").select("giorno").gte("giorno", meseIso),
    supabase.from("bozze_turni").select("id, mese, stato").eq("mese", meseIso),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const nome = nomeCompleto(s.persona);
  const ruoliTesto = s.ruoli.map((r) => RUOLO[r.ruolo]).join(", ");
  const admin = s.ruoli.some((r) => r.ruolo === "admin");
  const { data: personeScuola } = admin && s.scuolaId ? await supabase.rpc("persone_scuola", { p_scuola: s.scuolaId }) : { data: [] };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <Avatar accent size="lg">{iniziali(nome || "P")}</Avatar>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{nome || "Il tuo profilo"}</h1>
          <p className="text-sm text-muted-foreground">{ruoliTesto}{s.telefono ? ` · ${s.telefono}` : ""}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <H2>Avvisi sul telefono</H2>
        <Notifiche abbonamenti={abbonamenti ?? []} vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} canali={canali} />
      </div>

      {admin && (
        <>
          <div className="flex flex-col gap-2">
            <H2>Canali di notifica</H2>
            <Canali canali={canali} />
          </div>
          <div className="flex flex-col gap-2">
            <H2>Amministratori</H2>
            <Amministratori scuolaId={s.scuolaId!} io={s.userId} persone={personeScuola ?? []} />
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <H2>Accesso</H2>
        <Passkey />
      </div>

      {volontario && (
        <>
          <Disponibilita giorni={(disp ?? []).map((d) => d.giorno)} eccezioni={ecc ?? []} mese={meseIso} chiusure={(chiusure ?? []).map((c) => c.giorno)} bozzaFatta={(bozze ?? []).length > 0} />
          <div className="flex flex-col gap-2">
            <H2>Dotazioni</H2>
            <Card size="sm" className="px-3">
              <div className="flex items-center justify-between gap-2.5"><span className="flex items-center gap-2"><BriefcaseMedical size={16} /> Kit di primo soccorso</span><Badge variant={(dotazioni ?? []).some((d) => d.tipo === "kit") ? "success" : "secondary"}>{(dotazioni ?? []).some((d) => d.tipo === "kit") ? "consegnato" : "non assegnato"}</Badge></div>
              <div className="flex items-center justify-between gap-2.5"><span>Pettorina</span><span className="text-[13px] text-muted-foreground">{(dotazioni ?? []).find((d) => d.tipo === "pettorina")?.numero ? `n. ${(dotazioni ?? []).find((d) => d.tipo === "pettorina")!.numero}` : "—"}</span></div>
              <div className="flex items-center justify-between gap-2.5"><span>Paletta</span><span className="text-[13px] text-muted-foreground">{(dotazioni ?? []).some((d) => d.tipo === "paletta") ? "consegnata" : "personale"}</span></div>
            </Card>
          </div>
          <div className="flex flex-col gap-2">
            <H2>Requisiti</H2>
            <Card size="sm" className="px-3">
              <div className="flex items-center justify-between gap-2.5"><span>Albo dei volontari civici</span><Badge variant="success">verificato</Badge></div>
              <div className="flex items-center justify-between gap-2.5"><span>Assicurazione</span><span className="text-[13px] text-muted-foreground">a carico del Comune</span></div>
            </Card>
          </div>
        </>
      )}

      {(bambini ?? []).length > 0 && (
        <div className="flex flex-col gap-2">
          <H2>I tuoi bambini</H2>
          <Rows>
            {(bambini ?? []).map((b) => {
              const i = (iscrizioni ?? []).find((x) => x.bambino_id === b.id && x.stato === "approvata") ?? (iscrizioni ?? []).find((x) => x.bambino_id === b.id);
              const linea = linee?.find((l) => l.id === i?.linea_id)?.nome;
              const fermata = fermate?.find((f) => f.id === i?.fermata_id)?.ordine;
              return (
                <Row key={b.id}>
                  <Avatar>{iniziali(`${b.nome} ${b.cognome}`)}</Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold">{b.nome} {b.cognome}</div>
                    <div className="text-[13px] text-muted-foreground">{b.classe}{linea ? ` · ${linea}` : ""}{fermata ? `, fermata ${fermata}` : ""}{b.pettorina ? ` · pettorina n. ${b.pettorina}` : ""}</div>
                  </div>
                  <Badge variant={i?.stato === "approvata" ? "success" : i?.stato === "rifiutata" ? "destructive" : "brand"}>
                    {i?.stato === "approvata" ? "iscritto" : i?.stato === "rifiutata" ? "rifiutata" : "in attesa"}
                  </Badge>
                </Row>
              );
            })}
          </Rows>
        </div>
      )}

      {s.ruoli.some((r) => r.ruolo === "genitore") && (
        <div className="flex flex-col gap-2">
          <H2>Backup presenze</H2>
          <Backup delegati={(delegati ?? []).map((d) => ({ id: d.id, nome: `${d.nome} ${d.cognome}`, telefono: d.telefono, etichetta: deleghe?.find((x) => x.delegato_id === d.id)?.etichetta ?? null }))} />
        </div>
      )}

      {(contatti ?? []).length > 0 && (
        <div className="flex flex-col gap-2">
          <H2>Contatti d&apos;emergenza</H2>
          <p className="text-[13px] leading-[1.5] text-muted-foreground">Li vede solo il volontario di turno sulla linea dei tuoi bambini, e ogni consultazione resta registrata. Nessun dato sanitario.</p>
          <Rows>
            {(contatti ?? []).map((c) => (
              <Row key={c.id} className="min-h-14">
                <span className="flex-1">{c.nome} ({c.relazione})</span>
                <span className="tabular-nums text-[13px] text-muted-foreground">{c.telefono}</span>
              </Row>
            ))}
          </Rows>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <H2>Privacy</H2>
        <Card size="sm" className="px-3">
          <div className="flex items-center justify-between gap-2.5"><Link href="/informativa" className="underline underline-offset-2">Informativa privacy</Link><Badge variant="secondary">{informativa ? `v. ${informativa.versione} · ${new Date(informativa.valida_dal).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}` : "—"}</Badge></div>
          <div className="flex items-center justify-between gap-2.5"><span>Dati conservati</span><span className="text-[13px] text-muted-foreground">Unione Europea · fino a fine anno + 30 giorni</span></div>
        </Card>
      </div>

      {s.ruoli.some((r) => r.ruolo === "genitore") && (
        <Button variant="outline" className="w-full border-dashed" render={<Link href="/iscrizione" />}>{(bambini ?? []).length ? "Iscrivi un altro bambino" : "Iscrivi i tuoi bambini"}</Button>
      )}
      <form action={esci}>
        <Button variant="outline" type="submit" className="w-full"><LogOut size={18} /> Esci</Button>
      </form>
    </div>
  );
}
