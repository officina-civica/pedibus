import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessione } from "@/lib/sessione";
import { giornoLungo, oggiODomani, hhmm, oggiRome } from "@/lib/date";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { SchedaBambino } from "./scheda-bambino";
import type { StatoTurno } from "@/lib/database.types";

export const metadata: Metadata = { title: "Presenze" };

const ETICHETTA_STATO: Record<StatoTurno, string> = {
  programmato: "parte regolarmente", annullato_soglia: "annullata: sotto soglia", riattivato: "riattivata: soglia raggiunta",
  annullato_definitivo: "annullata", annullato_volontari: "annullata: volontari insufficienti", in_corso: "in viaggio", consegnato: "consegnata a scuola",
};
const PARTE: StatoTurno[] = ["programmato", "riattivato", "in_corso", "consegnato"];

export default async function PresenzePage() {
  const s = await getSessione();
  const supabase = await supabaseServer();

  const { data: linee } = await supabase.rpc("stato_mie_linee", {});
  const giorno = linee?.[0]?.giorno ?? (await supabase.rpc("mio_giorno_riferimento", {})).data ?? oggiRome();

  const [{ data: bambini }, { data: iscrizioni }, { data: presenze }, { data: deleghe }] = await Promise.all([
    supabase.from("bambini").select("*").order("nome"),
    supabase.from("iscrizioni").select("*").eq("stato", "approvata"),
    supabase.from("presenze").select("*").eq("giorno", giorno),
    supabase.from("deleghe").select("*").eq("genitore_id", s.userId),
  ]);
  const { data: fermate } = await supabase.from("fermate").select("*").in("id", (iscrizioni ?? []).map((i) => i.fermata_id));
  const { data: lineeTutte } = await supabase.from("linee").select("id, nome").in("id", (iscrizioni ?? []).map((i) => i.linea_id));

  const miei = (bambini ?? []).filter((b) => (iscrizioni ?? []).some((i) => i.bambino_id === b.id));
  const giornoLabel = oggiODomani(giorno);
  // La chiusura più vicina fra le mie linee decide il testo del promemoria.
  const chiusura = linee?.length ? linee.map((l) => l.ora_chiusura_assenze).sort()[0] : "18:00:00";
  const chiuse = assenzeChiuse(giorno, chiusura);

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">Presenze</h1>
        <p className="text-sm text-muted-foreground">{giornoLabel === "oggi" ? "Oggi" : "Domani"}, {giornoLungo(giorno).toLowerCase()}</p>
      </div>

      {chiuse ? (
        <Alert variant="warning">
          <Clock />
          <AlertTitle>{`Assenze chiuse alle ${hhmm(chiusura)}`}</AlertTitle>
          <AlertDescription>
            Puoi ancora segnalare o annullare un&apos;assenza: la modifica viene segnata come tardiva e i volontari di turno sono avvisati.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Clock />
          <AlertTitle>{`Segnala le assenze entro le ${hhmm(chiusura)}`}</AlertTitle>
          <AlertDescription>
            I tuoi bambini sono presenti salvo avviso. Si segnalano solo le assenze.
          </AlertDescription>
        </Alert>
      )}

      {miei.length === 0 && (
        <Card size="sm" className="px-3"><p className="text-[13px] text-muted-foreground">Nessun bambino con iscrizione approvata. Quando l&apos;amministratore approva l&apos;iscrizione, compare qui.</p></Card>
      )}

      {miei.map((b) => {
        const i = (iscrizioni ?? []).find((x) => x.bambino_id === b.id)!;
        const p = (presenze ?? []).find((x) => x.bambino_id === b.id);
        const fermata = (fermate ?? []).find((f) => f.id === i.fermata_id) ?? null;
        const linea = (lineeTutte ?? []).find((l) => l.id === i.linea_id) ?? null;
        return (
          <SchedaBambino
            key={b.id}
            bambino={{ id: b.id, nome: `${b.nome} ${b.cognome}`, classe: b.classe, femmina: b.genere === "F" }}
            linea={linea?.nome ?? ""} fermata={fermata ? `fermata ${fermata.ordine} (${fermata.nome})` : ""} orario={fermata ? hhmm(fermata.orario) : ""}
            giorno={giorno} giornoLabel={giornoLabel}
            assente={p?.stato === "assente"} tardiva={!!p?.tardiva}
          />
        );
      })}

      {(linee ?? []).map((l) => {
        const parte = PARTE.includes(l.stato);
        const pre = !chiuse && l.presenti < l.soglia_bambini && l.stato === "programmato";
        const variant = !parte ? "destructive" : pre ? "warning" : "success";
        return (
          <Alert key={l.linea_id} variant={variant}>
            <AlertTitle className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: l.colore }} />
              {l.nome}: {pre ? "per ora sotto soglia" : ETICHETTA_STATO[l.stato]}
            </AlertTitle>
            <AlertDescription>
              {l.presenti} bambini presenti {giornoLabel} · soglia minima {l.soglia_bambini}
              {pre && ` · si decide alle ${hhmm(l.ora_chiusura_assenze)}`}
              {l.consegnato_alle && ` · consegnati a scuola alle ${hhmm(l.consegnato_alle)}`}
            </AlertDescription>
          </Alert>
        );
      })}

      {deleghe && deleghe.length > 0 && (
        <p className="text-[13px] leading-[1.5] text-muted-foreground">
          Il backup che hai indicato ({deleghe.map((d) => d.etichetta).filter(Boolean).join(", ") || "una persona di fiducia"}) può segnare presenze e assenze al posto tuo, nient&apos;altro.
        </p>
      )}
    </div>
  );
}

/* Le assenze per `giorno` si chiudono la sera prima all'ora indicata (ora di Roma). */
function assenzeChiuse(giorno: string, chiusura: string) {
  const prima = new Date(giorno + "T00:00:00");
  prima.setDate(prima.getDate() - 1);
  const ymd = prima.toISOString().slice(0, 10);
  const oraRome = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Rome" }).replace(" ", "T"); // 2026-10-26T18:05:00
  return oraRome >= `${ymd}T${chiusura.slice(0, 8)}`;
}
