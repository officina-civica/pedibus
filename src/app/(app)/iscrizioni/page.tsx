import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { hhmm, quando } from "@/lib/date";
import { Card } from "@/components/ui/card";
import { H2, Rows } from "@/components/blocchi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RigaIscrizione, RigaRuolo } from "./righe";

export const metadata: Metadata = { title: "Iscrizioni" };

export default async function IscrizioniPage() {
  const supabase = await supabaseServer();
  const [{ data: iscrizioni }, { data: bambini }, { data: ruoli }, { data: linee }, { data: fermate }] = await Promise.all([
    supabase.from("iscrizioni").select("*").order("richiesta_il", { ascending: false }),
    supabase.from("bambini").select("*"),
    supabase.from("ruoli").select("*").eq("ruolo", "volontario").neq("stato", "approvata").order("richiesto_il", { ascending: false }),
    supabase.from("linee").select("id, nome, attiva").order("ora_partenza"),
    supabase.from("fermate").select("id, linea_id, ordine, nome, orario, arrivo").order("ordine"),
  ]);
  const personeIds = [...new Set([...(bambini ?? []).map((b) => b.genitore_id), ...(ruoli ?? []).map((r) => r.persona_id)])];
  const { data: persone } = personeIds.length ? await supabase.from("persone").select("id, nome, cognome, telefono").in("id", personeIds) : { data: [] };
  const nome = (id: string) => { const p = persone?.find((x) => x.id === id); return p ? `${p.nome} ${p.cognome}` : "—"; };

  const righe = (iscrizioni ?? []).map((i) => {
    const b = bambini?.find((x) => x.id === i.bambino_id);
    const dove = i.fermata_id
      ? `${linee?.find((l) => l.id === i.linea_id)?.nome ?? ""}, fermata ${fermate?.find((f) => f.id === i.fermata_id)?.ordine ?? "?"}`
      : "fermata da assegnare";
    return {
      id: i.id, stato: i.stato, when: quando(i.richiesta_il),
      genitore: b ? nome(b.genitore_id) : "—",
      dettaglio: `${b ? `${b.nome} ${b.cognome}, ${b.classe}` : "?"} · ${dove}`,
      motivo: i.motivo_rifiuto,
      daAssegnare: i.stato === "in_attesa" && !i.fermata_id,
    };
  });
  const inAttesa = righe.filter((r) => r.stato === "in_attesa");
  // Per assegnare linea e fermata in approvazione: linee attive e le loro fermate di salita.
  const opzioni = (linee ?? []).filter((l) => l.attiva).map((l) => ({
    id: l.id, nome: l.nome,
    fermate: (fermate ?? []).filter((f) => f.linea_id === l.id && !f.arrivo).map((f) => ({ id: f.id, label: `${f.ordine}. ${f.nome} (${hhmm(f.orario)})` })),
  }));
  const gestite = righe.filter((r) => r.stato !== "in_attesa").slice(0, 20);
  const ruoliAttesa = (ruoli ?? []).filter((r) => r.stato === "in_attesa");
  const iscritti = (iscrizioni ?? []).filter((i) => i.stato === "approvata").length;
  const { count: volontari } = await supabase.from("ruoli").select("persona_id", { count: "exact", head: true }).eq("ruolo", "volontario").eq("stato", "approvata");

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="text-[22px] font-bold tracking-tight">Iscrizioni</h1><p className="text-sm text-muted-foreground">Anno scolastico 2026/27</p></div>
        <Badge variant="brand">{inAttesa.length + ruoliAttesa.length} in attesa</Badge>
      </div>
      <p className="text-[13px] leading-[1.5] text-muted-foreground">Ogni iscrizione resta registrata con stato, data, chi l&apos;ha approvata e la versione dell&apos;informativa accettata. Per i volontari si verifica prima l&apos;iscrizione all&apos;albo civico.</p>

      {inAttesa.length + ruoliAttesa.length === 0 ? <Card size="sm" className="px-3"><p className="text-[13px] text-muted-foreground">Nessuna richiesta in attesa.</p></Card> : (
        <Rows>
          {ruoliAttesa.map((r) => <RigaRuolo key={r.persona_id + r.ruolo} personaId={r.persona_id} scuolaId={r.scuola_id} nome={nome(r.persona_id)} when={quando(r.richiesto_il)} note={r.note} />)}
          {inAttesa.map((r) => <RigaIscrizione key={r.id} {...r} opzioni={opzioni} />)}
        </Rows>
      )}

      {gestite.length > 0 && (
        <div className="flex flex-col gap-2">
          <H2>Gestite di recente</H2>
          <Rows>{gestite.map((r) => <RigaIscrizione key={r.id} {...r} />)}</Rows>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <H2>Riepilogo</H2>
        <div className="grid grid-cols-2 gap-2.5">
          <Card size="sm" className="px-3 gap-1"><H2>Bambini iscritti</H2><span className="text-[22px] font-bold">{iscritti}</span></Card>
          <Card size="sm" className="px-3 gap-1"><H2>Volontari</H2><span className="text-[22px] font-bold">{volontari ?? 0}</span></Card>
        </div>
      </div>
      <Button variant="outline" disabled title="In arrivo" className="w-full border-dashed"><Plus size={16} /> Inserisci a mano chi non usa l&apos;app</Button>
    </div>
  );
}
