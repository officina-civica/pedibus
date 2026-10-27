import type { Metadata } from "next";
import { Flag, TriangleAlert } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { giornoLungo, hhmm, oggiRome } from "@/lib/date";
import { turnoParte, ETICHETTA_TURNO } from "@/lib/turni";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { AppelloInCorso, ApriAppello } from "./appello-client";

export const metadata: Metadata = { title: "Appello" };

export default async function AppelloPage() {
  const supabase = await supabaseServer();
  // Il turno di oggi su cui sono di turno; se non c'è, il prossimo, solo da leggere.
  const { data: oggiId } = await supabase.rpc("mio_turno_oggi", {});
  const { data: prossimoId } = oggiId ? { data: oggiId } : await supabase.rpc("mio_prossimo_turno", {});
  if (!prossimoId) {
    return (
      <div className="flex flex-col gap-3.5">
        <Intestazione sotto={giornoLungo(oggiRome())} />
        <Card size="sm" className="px-3"><p className="text-[13px] leading-[1.5] text-muted-foreground">Nessun turno in programma: l&apos;appello si apre dal telefono di chi è di turno, al capolinea.</p></Card>
      </div>
    );
  }
  const [{ data: t }, { data: fermate }, { data: stato }] = await Promise.all([
    supabase.rpc("turno_dettaglio", { p_turno: prossimoId }),
    supabase.rpc("appello_anteprima", { p_turno: prossimoId }),
    supabase.rpc("appello_stato", { p_turno: prossimoId }),
  ]);
  if (!t) return null;
  const oggi = t.giorno === oggiRome();

  if (!turnoParte(t.stato)) {
    return (
      <div className="flex flex-col gap-3.5">
        <Intestazione sotto={giornoLungo(t.giorno)} />
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{`${t.linea.nome} ${ETICHETTA_TURNO[t.stato]}`}</AlertTitle>
          <AlertDescription>
            {t.motivo ? `${t.motivo}. ` : ""}Le famiglie sono state avvisate.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (stato) return <AppelloInCorso turno={t} stato={stato} />;

  return (
    <div className="flex flex-col gap-3.5">
      <Intestazione sotto={`${oggi ? "Oggi" : giornoLungo(t.giorno)}`} />
      <Card size="sm" className="px-3">
        <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ background: t.linea.colore }} /><span className="text-base font-semibold">{t.linea.nome}</span></div>
        <p className="text-[13px] leading-[1.5] text-muted-foreground">
          L&apos;appello si apre alle {hhmm(t.linea.ora_partenza)} al capolinea ({t.capolinea}). Attesi {t.attesi} bambini lungo {(fermate ?? []).filter((f) => !f.arrivo).length} fermate.
        </p>
        <div className="flex flex-col overflow-hidden rounded-xl border border-border">
          {(fermate ?? []).map((f) => (
            <div key={f.fermata_id} className="flex min-h-11 items-center gap-2.5 border-b border-border px-3 last:border-b-0">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${f.arrivo ? "bg-brand text-brand-foreground" : "bg-primary text-primary-foreground"}`}>{f.arrivo ? <Flag size={12} strokeWidth={3} /> : f.ordine}</span>
              <span className="flex-1 text-sm">{f.nome}{f.capolinea ? <span className="text-muted-foreground"> · capolinea</span> : f.arrivo ? <span className="text-muted-foreground"> · arrivo</span> : null}</span>
              <span className="tabular-nums text-[13px] text-muted-foreground">{hhmm(f.orario)}</span>
              {!f.arrivo && f.attesi > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{f.attesi}</span>}
            </div>
          ))}
        </div>
        {oggi && <ApriAppello turnoId={t.id} capolinea={t.capolinea ?? ""} sonoDiTurno={t.volontari.some((v) => v.sono_io && v.stato !== "non_viene")} />}
      </Card>
      <p className="text-[13px] leading-[1.5] text-muted-foreground">I contatti d&apos;emergenza dei bambini della linea sono visibili solo durante il turno, dal telefono in alto a destra.</p>
    </div>
  );
}

function Intestazione({ sotto }: { sotto: string }) {
  return (
    <div>
      <h1 className="text-[22px] font-bold tracking-tight">Appello</h1>
      <p className="text-sm text-muted-foreground">{sotto}</p>
    </div>
  );
}
