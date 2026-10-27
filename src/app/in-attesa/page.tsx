import type { Metadata } from "next";
import { Hourglass } from "lucide-react";
import { getSessione, nomeCompleto } from "@/lib/sessione";
import { supabaseServer } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { esci } from "@/app/(app)/azioni";

export const metadata: Metadata = { title: "In attesa" };

/* Chi è entrato ma non ha ancora un ruolo approvato: l'amministratore deve ancora decidere. */
export default async function InAttesaPage() {
  const s = await getSessione();
  const supabase = await supabaseServer();
  const { data: ruoli } = await supabase.from("ruoli").select("*").eq("persona_id", s.userId);
  const inAttesa = (ruoli ?? []).filter((r) => r.stato === "in_attesa");
  const rifiutati = (ruoli ?? []).filter((r) => r.stato === "rifiutata");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-3.5 px-4 pt-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent-fg"><Hourglass size={28} /></span>
      <h1 className="text-[22px] font-bold tracking-tight">{nomeCompleto(s.persona) ? `Ciao ${s.persona!.nome}` : "Quasi pronto"}</h1>
      <p className="text-sm text-muted">
        {inAttesa.length
          ? "La tua richiesta è arrivata all'amministratore: quando la approva ricevi un avviso e l'app si apre."
          : rifiutati.length
          ? "La tua richiesta non è stata approvata. Contatta il comitato per i dettagli."
          : "Il tuo numero non risulta ancora iscritto al pedibus. Se hai fatto l'iscrizione, l'amministratore la sta verificando; altrimenti contatta il comitato."}
      </p>
      <form action={esci} className="mt-4 w-full"><Button type="submit" block>Esci</Button></form>
    </main>
  );
}
