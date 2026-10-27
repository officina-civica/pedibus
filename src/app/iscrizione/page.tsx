import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSessione } from "@/lib/sessione";
import { Button } from "@/components/ui/button";
import { IscrizioneForm } from "./iscrizione-form";

export const metadata: Metadata = { title: "Iscrizione" };

/* Il modulo del prototipo: genitore, bambino, fermata scelta a parte, consenso versionato. */
export default async function IscrizionePage() {
  const s = await getSessione();
  if (!s.registrato) redirect("/registrazione");
  const supabase = await supabaseServer();
  const [{ data: scuole }, { data: linee }, { data: fermate }, { data: informative }] = await Promise.all([
    supabase.from("scuole").select("*").order("nome"),
    supabase.from("linee").select("id, scuola_id, nome").eq("attiva", true).order("ora_partenza"),
    supabase.from("fermate").select("id, linea_id, ordine, nome, orario").eq("arrivo", false).order("ordine"),
    supabase.from("informative").select("*").order("valida_dal", { ascending: false }).limit(1),
  ]);
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col bg-card sm:min-h-screen sm:border-x sm:border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <Button variant="outline" size="sm" render={<Link href={s.ruoloAttivo ? "/profilo" : "/in-attesa"} />}><ArrowLeft /> Indietro</Button>
        <span className="text-[13px] text-muted-foreground">Iscrizione</span>
      </div>
      <IscrizioneForm
        persona={{ nome: s.persona!.nome, cognome: s.persona!.cognome, telefono: s.persona?.telefono ?? (s.telefono ? `+${s.telefono.replace(/^\+/, "")}` : null), informativaId: s.persona?.informativa_id ?? null }}
        scuole={scuole ?? []} linee={linee ?? []} fermate={fermate ?? []} informativa={informative?.[0] ?? null}
      />
    </main>
  );
}
