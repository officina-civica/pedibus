import type { Metadata } from "next";
import { Flag } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { hhmm } from "@/lib/date";
import { Card } from "@/components/ui/card";
import { H2 } from "@/components/blocchi";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Linee" };

/* Le linee come le vede l'amministratore: fermate, bambini per fermata, soglie. La modifica arriva dopo. */
export default async function LineePage() {
  const supabase = await supabaseServer();
  const [{ data: linee }, { data: fermate }, { data: iscrizioni }, { data: chiusure }] = await Promise.all([
    supabase.from("linee").select("*").order("ora_partenza"),
    supabase.from("fermate").select("*").order("ordine"),
    supabase.from("iscrizioni").select("linea_id, fermata_id").eq("stato", "approvata"),
    supabase.from("calendario_chiusure").select("*").gte("giorno", new Date().toISOString().slice(0, 10)).order("giorno"),
  ]);

  return (
    <div className="flex flex-col gap-3.5">
      <div><h1 className="text-[22px] font-bold tracking-tight">Linee</h1><p className="text-sm text-muted-foreground">Fermate, orari e soglie per linea</p></div>
      {(linee ?? []).map((l) => {
        const st = (fermate ?? []).filter((f) => f.linea_id === l.id);
        const iscritti = (iscrizioni ?? []).filter((i) => i.linea_id === l.id);
        return (
          <div key={l.id} className="flex flex-col overflow-hidden rounded-xl border border-border">
            <div className="flex items-center gap-3 bg-muted px-3 py-3">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: l.colore }} />
              <span className="flex-1"><span className="block text-base font-semibold">{l.nome}</span><span className="text-[13px] text-muted-foreground">{st.filter((f) => !f.arrivo).length} fermate · {iscritti.length} bambini · {hhmm(l.ora_partenza)} → {hhmm(l.ora_arrivo)}</span></span>
              <Badge variant={l.attiva ? "success" : "secondary"}>{l.attiva ? "attiva" : "sospesa"}</Badge>
            </div>
            {st.map((f) => (
              <div key={f.id} className="flex min-h-11 items-center gap-2.5 border-t border-border px-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${f.arrivo ? "bg-brand text-brand-foreground" : "bg-primary text-primary-foreground"}`}>{f.arrivo ? <Flag size={12} strokeWidth={3} /> : f.ordine}</span>
                <span className="flex-1 text-sm font-medium">{f.nome}{f.capolinea ? <span className="font-normal text-muted-foreground"> · capolinea</span> : f.arrivo ? <span className="font-normal text-muted-foreground"> · arrivo</span> : null}</span>
                <span className="tabular-nums text-[13px] text-muted-foreground">{hhmm(f.orario)}</span>
                {!f.arrivo && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{iscritti.filter((i) => i.fermata_id === f.id).length || ""}</span>}
              </div>
            ))}
            <div className="grid grid-cols-3 border-t border-border">
              <div className="border-r border-border px-3 py-2.5"><H2 className="text-[11px]">Volontari min.</H2><b className="text-base">{l.min_volontari}</b> <span className="text-[13px] text-muted-foreground">(cons. {l.volontari_consigliati})</span></div>
              <div className="border-r border-border px-3 py-2.5"><H2 className="text-[11px]">Soglia bimbi</H2><b className="text-base">{l.soglia_bambini}</b></div>
              <div className="px-3 py-2.5"><H2 className="text-[11px]">Chiusura</H2><b className="text-base">{hhmm(l.ora_chiusura_assenze)}</b> <span className="text-[13px] text-muted-foreground">/ {hhmm(l.ora_soglia_definitiva)}</span></div>
            </div>
          </div>
        );
      })}
      <div className="flex flex-col gap-2">
        <H2>Giorni senza pedibus</H2>
        <Card size="sm" className="px-3">
          {(chiusure ?? []).length === 0 ? <p className="text-[13px] text-muted-foreground">Nessuna chiusura in calendario.</p> : (chiusure ?? []).map((c) => (
            <div key={c.giorno} className="flex items-center justify-between text-sm"><span>{new Date(c.giorno + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "long" })}</span><span className="text-muted-foreground">{c.motivo}</span></div>
          ))}
          <p className="text-[13px] text-muted-foreground">Nei giorni in calendario non si generano né turni né appelli. Soglie, orari e minimo volontari si modificano per ora dal pannello Supabase.</p>
        </Card>
      </div>
    </div>
  );
}
