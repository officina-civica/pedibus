import type { Metadata } from "next";
import Link from "next/link";
import { Check, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { giornoLungo, hhmm, oggiODomani, quando } from "@/lib/date";
import { turnoParte } from "@/lib/turni";
import { Alert } from "@/components/ui/alert";
import { Card, H2 } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Oggi" };

export default async function OggiPage() {
  const supabase = await supabaseServer();
  const { data: r, error } = await supabase.rpc("riepilogo_admin", {});
  if (error || !r) return <Alert tone="danger">{error?.message ?? "Nessun dato"}</Alert>;
  const g = r.giorno;
  const label = oggiODomani(g);

  const alerts: React.ReactNode[] = [];
  for (const l of r.linee) {
    const k = l.id;
    if (l.stato === "annullato_soglia") alerts.push(<Alert key={k + "s"} tone="warn" icon={<TriangleAlert size={16} />} title={`${l.nome} sotto soglia per ${label}`}>{l.presenti} bambini presenti, minimo {l.soglia_bambini}. Annullata alle {hhmm("18:00")}; si riattiva da sola se entro le 21:00 si arriva a {l.soglia_bambini}.</Alert>);
    if (l.stato === "riattivato") alerts.push(<Alert key={k + "r"} tone="ok" icon={<Check size={16} />} title={`${l.nome} riattivata`}>{l.presenti} bambini presenti: soglia raggiunta con una modifica tardiva.</Alert>);
    if (l.stato === "annullato_definitivo") alerts.push(<Alert key={k + "d"} tone="danger" icon={<TriangleAlert size={16} />} title={`${l.nome} annullata per ${label}`}>Soglia non raggiunta entro le 21:00. Famiglie e volontari avvisati.</Alert>);
    if (l.stato === "annullato_volontari") alerts.push(<Alert key={k + "v"} tone="danger" icon={<TriangleAlert size={16} />} title={`${l.nome} annullata: volontari insufficienti`}>{l.copertura} su {l.min_volontari} un&apos;ora prima della partenza. Famiglie avvisate.</Alert>);
    if (l.escalation_dal && l.copertura < l.min_volontari && turnoParte(l.stato)) alerts.push(<Alert key={k + "e"} tone="warn" icon={<Users size={16} />} title={`${l.nome}: turno scoperto (${l.copertura} su ${l.min_volontari})`}>{l.mancanti} non {l.mancanti.includes(",") ? "vengono" : "viene"}. Backup avvisati alle {quando(l.escalation_dal)}{l.escalation_allargata_il ? ", poi tutti i volontari" : ""}; se nessuno risponde, tocca a te chiamare qualcuno.</Alert>);
    if (l.escalation_dal && l.copertura >= l.min_volontari && turnoParte(l.stato) && l.mancanti) alerts.push(<Alert key={k + "c"} tone="ok" icon={<Check size={16} />} title={`${l.nome}: turno coperto`}>{l.mancanti} non viene, qualcuno ha preso il posto. {l.copertura} su {l.min_volontari}{l.kit_presente ? ", kit presente" : ", nessun kit"}.</Alert>);
    if (l.consegnato_alle) alerts.push(<Alert key={k + "ok"} tone="ok" icon={<Check size={16} />} title={`${l.nome} consegnata alle ${hhmm(l.consegnato_alle)}`}>{l.presenti} bambini a scuola con {l.volontari}.</Alert>);
  }
  if (!alerts.length) alerts.push(<Alert key="ok" tone="ok" icon={<Check size={16} />} title="Tutto regolare">Nessuna linea sotto soglia, nessun turno scoperto.</Alert>);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Amministrazione</h1>
          <p className="text-sm text-muted">{label === "oggi" ? "Oggi" : "Domani"}, {giornoLungo(g).toLowerCase()}</p>
        </div>
        <Badge tone="muted"><ShieldCheck size={12} /> admin</Badge>
      </div>
      {alerts}
      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/iscrizioni" className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3.5">
          <H2>Iscrizioni in attesa</H2>
          <span className="text-[22px] font-bold">{r.iscrizioni_in_attesa + r.ruoli_in_attesa}</span>
          <span className="text-[13px] text-muted">{r.iscrizioni_in_attesa + r.ruoli_in_attesa ? "da approvare" : "tutto approvato"}</span>
        </Link>
        <Card className="gap-1">
          <H2>Bambini {label}</H2>
          <span className="text-[22px] font-bold">{r.linee.reduce((n, l) => n + l.presenti, 0)}</span>
          <span className="text-[13px] text-muted">{r.linee.map((l) => `${l.nome.replace("Linea ", "")} ${l.presenti}`).join(" · ")}</span>
        </Card>
      </div>
      <div className="flex flex-col gap-2">
        <H2>Turni di {label}</H2>
        <div className="grid grid-cols-2 gap-2.5">
          {r.linee.map((l) => (
            <Card key={l.id} className="gap-1">
              <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ background: l.colore }} /><b>{l.nome}</b></div>
              <span className="text-[22px] font-bold">{l.copertura} <span className="text-[13px] font-medium text-muted">/ {l.min_volontari} min</span></span>
              <span className={`text-[13px] ${l.kit_presente ? "text-ok-fg" : "text-accent-fg"}`}>{l.kit_presente ? "kit presente" : "nessun kit"} · {l.volontari}</span>
              <Badge tone={turnoParte(l.stato) ? "ok" : "danger"} className="self-start">{turnoParte(l.stato) ? "parte" : "annullata"}</Badge>
            </Card>
          ))}
        </div>
      </div>
      {r.bozza && r.bozza.stale && (
        <Alert tone="warn" icon={<TriangleAlert size={16} />} title="Bozza del mese da rivedere">Una disponibilità è cambiata dopo la generazione. <Link href="/turni" className="font-semibold underline">Vai ai turni</Link></Alert>
      )}
    </div>
  );
}
