import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessione } from "@/lib/sessione";
import { H2 } from "@/components/blocchi";
import { LineaCard } from "./linea-card";
import { NuovaLinea } from "./nuova-linea";
import { Chiusure } from "./chiusure";

export const metadata: Metadata = { title: "Linee" };

/* Le linee come le gestisce l'amministratore: fermate, orari, soglie, sospensione, giorni senza pedibus. */
export default async function LineePage() {
  const s = await getSessione();
  const supabase = await supabaseServer();
  const [{ data: linee }, { data: fermate }, { data: iscrizioni }, { data: chiusure }] = await Promise.all([
    supabase.from("linee").select("*").order("ora_partenza").order("nome"),
    supabase.from("fermate").select("*").order("ordine"),
    supabase.from("iscrizioni").select("linea_id, fermata_id").eq("stato", "approvata"),
    supabase.from("calendario_chiusure").select("giorno, motivo").gte("giorno", new Date().toISOString().slice(0, 10)).order("giorno"),
  ]);
  const scuolaId = s.scuolaId ?? linee?.[0]?.scuola_id ?? "";

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="text-[22px] font-bold tracking-tight">Linee</h1><p className="text-sm text-muted-foreground">Fermate, orari e soglie per linea</p></div>
        {scuolaId && <NuovaLinea scuolaId={scuolaId} />}
      </div>
      {(linee ?? []).length === 0 && <p className="text-[13px] text-muted-foreground">Nessuna linea ancora: creane una, poi aggiungi le fermate.</p>}
      {(linee ?? []).map((l) => {
        const st = (fermate ?? []).filter((f) => f.linea_id === l.id);
        const isc = (iscrizioni ?? []).filter((i) => i.linea_id === l.id);
        const perFermata: Record<string, number> = {};
        for (const i of isc) if (i.fermata_id) perFermata[i.fermata_id] = (perFermata[i.fermata_id] ?? 0) + 1;
        return <LineaCard key={l.id} scuolaId={l.scuola_id} linea={l} fermate={st} iscrittiPerFermata={perFermata} iscritti={isc.length} />;
      })}
      <div className="flex flex-col gap-2">
        <H2>Giorni senza pedibus</H2>
        {scuolaId && <Chiusure scuolaId={scuolaId} chiusure={chiusure ?? []} />}
      </div>
    </div>
  );
}
