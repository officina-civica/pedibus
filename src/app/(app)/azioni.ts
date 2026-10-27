"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { HOME } from "@/lib/sessione";
import type { RuoloTipo, StatoPresenza } from "@/lib/database.types";

export async function cambiaRuolo(ruolo: RuoloTipo) {
  (await cookies()).set("ruolo", ruolo, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(HOME[ruolo]);
}

export async function esci() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  (await cookies()).delete("ruolo");
  redirect("/accesso");
}

/* Presenze: la regola (tardività, soglie, avvisi) sta nel database. Qui solo il passaggio. */
export async function segnaPresenza(bambinoId: string, stato: StatoPresenza, giorno: string): Promise<{ ok: boolean; messaggio: string }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("segna_presenza", { p_bambino: bambinoId, p_stato: stato, p_giorno: giorno });
  if (error) return { ok: false, messaggio: error.message };
  revalidatePath("/presenze");
  return { ok: true, messaggio: data ?? "Fatto." };
}

export async function segnaAvvisiLetti() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("avvisi").update({ letto_il: new Date().toISOString() }).eq("destinatario_id", user.id).is("letto_il", null);
}

export async function salvaAbbonamentoPush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("push_abbonamenti").upsert(
    { persona_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent },
    { onConflict: "endpoint" },
  );
  return { ok: !error, errore: error?.message };
}

export async function rimuoviAbbonamentoPush(endpoint: string) {
  const supabase = await supabaseServer();
  await supabase.from("push_abbonamenti").delete().eq("endpoint", endpoint);
  return { ok: true };
}

export async function aggiungiDelega(telefono: string, etichetta: string): Promise<{ ok: boolean; messaggio: string }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("aggiungi_delega", { p_telefono: telefono, p_etichetta: etichetta || null });
  if (error) return { ok: false, messaggio: error.message };
  revalidatePath("/profilo");
  return { ok: data === "Backup aggiunto.", messaggio: data ?? "Fatto." };
}

export async function rimuoviDelega(delegatoId: string) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("deleghe").delete().eq("genitore_id", user.id).eq("delegato_id", delegatoId);
  revalidatePath("/profilo");
}
