import type { Metadata } from "next";
import Link from "next/link";
import { Check, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { giornoLungo, hhmm, oggiODomani, quando } from "@/lib/date";
import { turnoParte } from "@/lib/turni";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { H2 } from "@/components/blocchi";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Oggi" };

export default async function OggiPage() {
  const supabase = await supabaseServer();
  const { data: r, error } = await supabase.rpc("riepilogo_admin", {});
  if (error || !r) return <Alert variant="destructive"><AlertDescription>{error?.message ?? "Nessun dato"}</AlertDescription></Alert>;
  const g = r.giorno;
  const label = oggiODomani(g);

  const alerts: React.ReactNode[] = [];
  for (const l of r.linee) {
    const k = l.id;
    if (l.stato === "annullato_soglia") alerts.push(<Alert key={k + "s"} variant="warning"><TriangleAlert /><AlertTitle>{`${l.nome} sotto soglia per ${label}`}</AlertTitle><AlertDescription>{l.presenti} bambini presenti, minimo {l.soglia_bambini}. Annullata alle {hhmm("18:00")}; si riattiva da sola se entro le 21:00 si arriva a {l.soglia_bambini}.</AlertDescription></Alert>);
    if (l.stato === "riattivato") alerts.push(<Alert key={k + "r"} variant="success"><Check /><AlertTitle>{`${l.nome} riattivata`}</AlertTitle><AlertDescription>{l.presenti} bambini presenti: soglia raggiunta con una modifica tardiva.</AlertDescription></Alert>);
    if (l.stato === "annullato_definitivo") alerts.push(<Alert key={k + "d"} variant="destructive"><TriangleAlert /><AlertTitle>{`${l.nome} annullata per ${label}`}</AlertTitle><AlertDescription>Soglia non raggiunta entro le 21:00. Famiglie e volontari avvisati.</AlertDescription></Alert>);
    if (l.stato === "annullato_volontari") alerts.push(<Alert key={k + "v"} variant="destructive"><TriangleAlert /><AlertTitle>{`${l.nome} annullata: volontari insufficienti`}</AlertTitle><AlertDescription>{l.copertura} su {l.min_volontari} un&apos;ora prima della partenza. Famiglie avvisate.</AlertDescription></Alert>);
    if (l.escalation_dal && l.copertura < l.min_volontari && turnoParte(l.stato)) alerts.push(<Alert key={k + "e"} variant="warning"><Users /><AlertTitle>{`${l.nome}: turno scoperto (${l.copertura} su ${l.min_volontari})`}</AlertTitle><AlertDescription>{l.mancanti} non {l.mancanti.includes(",") ? "vengono" : "viene"}. Backup avvisati alle {quando(l.escalation_dal)}{l.escalation_allargata_il ? ", poi tutti i volontari" : ""}; se nessuno risponde, tocca a te chiamare qualcuno.</AlertDescription></Alert>);
    if (l.escalation_dal && l.copertura >= l.min_volontari && turnoParte(l.stato) && l.mancanti) alerts.push(<Alert key={k + "c"} variant="success"><Check /><AlertTitle>{`${l.nome}: turno coperto`}</AlertTitle><AlertDescription>{l.mancanti} non viene, qualcuno ha preso il posto. {l.copertura} su {l.min_volontari}{l.kit_presente ? ", kit presente" : ", nessun kit"}.</AlertDescription></Alert>);
    if (l.consegnato_alle) alerts.push(<Alert key={k + "ok"} variant="success"><Check /><AlertTitle>{`${l.nome} consegnata alle ${hhmm(l.consegnato_alle)}`}</AlertTitle><AlertDescription>{l.presenti} bambini a scuola con {l.volontari}.</AlertDescription></Alert>);
  }
  if (!alerts.length) alerts.push(<Alert key="ok" variant="success"><Check /><AlertTitle>Tutto regolare</AlertTitle><AlertDescription>Nessuna linea sotto soglia, nessun turno scoperto.</AlertDescription></Alert>);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Amministrazione</h1>
          <p className="text-sm text-muted-foreground">{label === "oggi" ? "Oggi" : "Domani"}, {giornoLungo(g).toLowerCase()}</p>
        </div>
        <Badge variant="secondary"><ShieldCheck size={12} /> admin</Badge>
      </div>
      {alerts}
      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/iscrizioni" className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3.5">
          <H2>Iscrizioni in attesa</H2>
          <span className="text-[22px] font-bold">{r.iscrizioni_in_attesa + r.ruoli_in_attesa}</span>
          <span className="text-[13px] text-muted-foreground">{r.iscrizioni_in_attesa + r.ruoli_in_attesa ? "da approvare" : "tutto approvato"}</span>
        </Link>
        <Card size="sm" className="px-3 gap-1">
          <H2>Bambini {label}</H2>
          <span className="text-[22px] font-bold">{r.linee.reduce((n, l) => n + l.presenti, 0)}</span>
          <span className="text-[13px] text-muted-foreground">{r.linee.map((l) => `${l.nome.replace("Linea ", "")} ${l.presenti}`).join(" · ")}</span>
        </Card>
      </div>
      <div className="flex flex-col gap-2">
        <H2>Turni di {label}</H2>
        <div className="grid grid-cols-2 gap-2.5">
          {r.linee.map((l) => (
            <Card key={l.id} size="sm" className="px-3 gap-1">
              <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ background: l.colore }} /><b>{l.nome}</b></div>
              <span className="text-[22px] font-bold">{l.copertura} <span className="text-[13px] font-medium text-muted-foreground">/ {l.min_volontari} min</span></span>
              <span className={`text-[13px] ${l.kit_presente ? "text-success" : "text-brand"}`}>{l.kit_presente ? "kit presente" : "nessun kit"} · {l.volontari}</span>
              <Badge variant={turnoParte(l.stato) ? "success" : "destructive"} className="self-start">{turnoParte(l.stato) ? "parte" : "annullata"}</Badge>
            </Card>
          ))}
        </div>
      </div>
      {r.bozza && r.bozza.stale && (
        <Alert variant="warning"><TriangleAlert /><AlertTitle>Bozza del mese da rivedere</AlertTitle><AlertDescription>Una disponibilità è cambiata dopo la generazione. <Link href="/turni" className="font-semibold underline">Vai ai turni</Link></AlertDescription></Alert>
      )}
    </div>
  );
}
