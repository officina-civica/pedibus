import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessione } from "@/lib/sessione";
import { supabaseServer } from "@/lib/supabase/server";
import { RegistrazioneForm } from "./registrazione-form";

export const metadata: Metadata = { title: "Registrazione" };

/* Dopo il primo accesso: chi sei. Una volta sola; chi è già registrato non la rivede. */
export default async function RegistrazionePage() {
  const s = await getSessione();
  if (s.registrato) redirect("/");
  const supabase = await supabaseServer();
  const [{ data: scuole }, { data: informative }] = await Promise.all([
    supabase.from("scuole").select("*").order("nome"),
    supabase.from("informative").select("*").order("valida_dal", { ascending: false }).limit(1),
  ]);
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col bg-card sm:min-h-screen sm:border-x sm:border-border">
      <RegistrazioneForm telefono={s.telefono ? `+${s.telefono.replace(/^\+/, "")}` : null} scuole={scuole ?? []} informativa={informative?.[0] ?? null} />
    </main>
  );
}
