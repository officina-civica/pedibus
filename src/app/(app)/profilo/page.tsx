import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessione, nomeCompleto } from "@/lib/sessione";
import { Avatar, Card, H2, Row, Rows } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { iniziali } from "@/lib/utils";
import { esci } from "@/app/(app)/azioni";
import { Notifiche } from "./notifiche";
import { Passkey } from "./passkey";

export const metadata: Metadata = { title: "Profilo" };

const RUOLO: Record<string, string> = { genitore: "Genitore principale", volontario: "Volontario civico", admin: "Amministratore" };

export default async function ProfiloPage() {
  const s = await getSessione();
  const supabase = await supabaseServer();
  const [{ data: bambini }, { data: iscrizioni }, { data: deleghe }, { data: contatti }, { data: abbonamenti }] = await Promise.all([
    supabase.from("bambini").select("*").eq("genitore_id", s.userId).order("nome"),
    supabase.from("iscrizioni").select("*"),
    supabase.from("deleghe").select("*").eq("genitore_id", s.userId),
    supabase.from("contatti_emergenza").select("*").order("ordine"),
    supabase.from("push_abbonamenti").select("id, endpoint, user_agent, creato_il, fallito_il").eq("persona_id", s.userId),
  ]);
  const ids = [...new Set((iscrizioni ?? []).map((i) => i.linea_id))];
  const { data: linee } = ids.length ? await supabase.from("linee").select("id, nome").in("id", ids) : { data: [] };
  const { data: fermate } = await supabase.from("fermate").select("id, ordine").in("id", (iscrizioni ?? []).map((i) => i.fermata_id));
  const { data: delegati } = deleghe?.length ? await supabase.from("persone").select("id, nome, cognome, telefono").in("id", deleghe.map((d) => d.delegato_id)) : { data: [] };
  const informativa = (await supabase.from("informative").select("*").order("valida_dal", { ascending: false }).limit(1)).data?.[0];

  const nome = nomeCompleto(s.persona);
  const ruoliTesto = s.ruoli.map((r) => RUOLO[r.ruolo]).join(", ");

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <Avatar accent size="lg">{iniziali(nome || "P")}</Avatar>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{nome || "Il tuo profilo"}</h1>
          <p className="text-sm text-muted">{ruoliTesto}{s.telefono ? ` · ${s.telefono}` : ""}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <H2>Avvisi sul telefono</H2>
        <Notifiche abbonamenti={abbonamenti ?? []} vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      </div>

      <div className="flex flex-col gap-2">
        <H2>Accesso</H2>
        <Passkey />
      </div>

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
                    <div className="text-[13px] text-muted">{b.classe}{linea ? ` · ${linea}` : ""}{fermata ? `, fermata ${fermata}` : ""}{b.pettorina ? ` · pettorina n. ${b.pettorina}` : ""}</div>
                  </div>
                  <Badge tone={i?.stato === "approvata" ? "ok" : i?.stato === "rifiutata" ? "danger" : "accent"}>
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
          {delegati && delegati.length > 0 ? (
            <Card>
              {delegati.map((d) => (
                <div key={d.id} className="flex items-center gap-3">
                  <Avatar>{iniziali(`${d.nome} ${d.cognome}`)}</Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold">{d.nome} {d.cognome}{deleghe?.find((x) => x.delegato_id === d.id)?.etichetta ? ` (${deleghe.find((x) => x.delegato_id === d.id)!.etichetta})` : ""}</div>
                    <div className="text-[13px] text-muted">{d.telefono ?? ""}{d.telefono ? " · " : ""}può solo segnare presenze e assenze</div>
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <Card><p className="text-[13px] text-muted">Nessun backup indicato. Un backup (l&apos;altro genitore, un nonno) può segnare presenze e assenze al posto tuo, nient&apos;altro. Si aggiunge dall&apos;amministratore, per ora.</p></Card>
          )}
        </div>
      )}

      {(contatti ?? []).length > 0 && (
        <div className="flex flex-col gap-2">
          <H2>Contatti d&apos;emergenza</H2>
          <p className="text-[13px] leading-[1.5] text-muted">Li vede solo il volontario di turno sulla linea dei tuoi bambini, e ogni consultazione resta registrata. Nessun dato sanitario.</p>
          <Rows>
            {(contatti ?? []).map((c) => (
              <Row key={c.id} className="min-h-14">
                <span className="flex-1">{c.nome} ({c.relazione})</span>
                <span className="tabular text-[13px] text-muted">{c.telefono}</span>
              </Row>
            ))}
          </Rows>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <H2>Privacy</H2>
        <Card>
          <div className="flex items-center justify-between gap-2.5"><span>Informativa privacy</span><Badge tone="muted">{informativa ? `v. ${informativa.versione} · ${new Date(informativa.valida_dal).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}` : "—"}</Badge></div>
          <div className="flex items-center justify-between gap-2.5"><span>Dati conservati</span><span className="text-[13px] text-muted">Unione Europea · fino a fine anno + 30 giorni</span></div>
        </Card>
      </div>

      <form action={esci}>
        <Button type="submit" block><LogOut size={18} /> Esci</Button>
      </form>
    </div>
  );
}
