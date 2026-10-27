import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Persona, Ruolo, RuoloTipo } from "@/lib/database.types";

export type Sessione = {
  userId: string;
  telefono: string | null;
  persona: Persona | null;
  ruoli: Ruolo[];              // solo quelli approvati
  ruoloAttivo: RuoloTipo | null;
  scuolaId: string | null;
};

export const HOME: Record<RuoloTipo, string> = { genitore: "/presenze", volontario: "/turni", admin: "/oggi" };
const PRIORITA: RuoloTipo[] = ["genitore", "volontario", "admin"];

/* Chi è l'utente e con quale ruolo sta usando l'app. Il ruolo attivo si sceglie dalla
   barra in alto (cookie "ruolo") quando una persona ne ha più d'uno. */
export async function getSessione(): Promise<Sessione> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/accesso");

  const [{ data: persona }, { data: ruoliTutti }] = await Promise.all([
    supabase.from("persone").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("ruoli").select("*").eq("persona_id", user.id),
  ]);
  const ruoli = (ruoliTutti ?? []).filter((r) => r.stato === "approvata");
  const scelto = (await cookies()).get("ruolo")?.value as RuoloTipo | undefined;
  const disponibili = PRIORITA.filter((r) => ruoli.some((x) => x.ruolo === r));
  const ruoloAttivo = scelto && disponibili.includes(scelto) ? scelto : (disponibili[0] ?? null);
  const scuolaId = ruoli.find((r) => r.ruolo === ruoloAttivo)?.scuola_id ?? ruoli[0]?.scuola_id ?? null;

  return { userId: user.id, telefono: user.phone ?? null, persona: persona ?? null, ruoli, ruoloAttivo, scuolaId };
}

export const nomeCompleto = (p: Persona | null) => (p ? `${p.nome} ${p.cognome}`.trim() : "");
