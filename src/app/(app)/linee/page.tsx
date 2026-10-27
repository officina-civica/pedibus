import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { hhmm } from "@/lib/date";
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
    supabase.from("iscrizioni").select("id, bambino_id, linea_id, fermata_id").eq("stato", "approvata"),
    supabase.from("calendario_chiusure").select("giorno, motivo").gte("giorno", new Date().toISOString().slice(0, 10)).order("giorno"),
  ]);
  const scuolaId = s.scuolaId ?? linee?.[0]?.scuola_id ?? "";
  const idsBambini = (iscrizioni ?? []).map((i) => i.bambino_id);
  const { data: bambini } = idsBambini.length ? await supabase.from("bambini").select("id, nome, cognome, classe").in("id", idsBambini) : { data: [] };
  // Dove si può spostare un bambino: linee attive e le loro fermate di salita.
  const destinazioni = (linee ?? []).filter((l) => l.attiva).map((l) => ({
    id: l.id, nome: l.nome,
    fermate: (fermate ?? []).filter((f) => f.linea_id === l.id && !f.arrivo).map((f) => ({ id: f.id, label: `${f.ordine}. ${f.nome} (${hhmm(f.orario)})` })),
  }));

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
        const perFermata: Record<string, { iscrizioneId: string; nome: string; classe: string }[]> = {};
        for (const i of isc) {
          if (!i.fermata_id) continue;
          const b = bambini?.find((x) => x.id === i.bambino_id);
          (perFermata[i.fermata_id] ??= []).push({ iscrizioneId: i.id, nome: b ? `${b.nome} ${b.cognome}` : "?", classe: b?.classe ?? "" });
        }
        return <LineaCard key={l.id} scuolaId={l.scuola_id} linea={l} fermate={st} bambiniPerFermata={perFermata} iscritti={isc.length} destinazioni={destinazioni} />;
      })}
      <div className="flex flex-col gap-2">
        <H2>Giorni senza pedibus</H2>
        {scuolaId && <Chiusure scuolaId={scuolaId} chiusure={chiusure ?? []} />}
      </div>
    </div>
  );
}
