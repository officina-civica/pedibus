"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { HOME } from "@/lib/sessione";
import type { RuoloTipo, StatoPresenza } from "@/lib/database.types";

/* Chi sta chiamando, dal JWT verificato in locale (niente chiamata al server di autenticazione). */
async function utenteId(supabase: Awaited<ReturnType<typeof supabaseServer>>): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

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
  const userId = await utenteId(supabase);
  if (!userId) return;
  await supabase.from("avvisi").update({ letto_il: new Date().toISOString() }).eq("destinatario_id", userId).is("letto_il", null);
}

export async function salvaAbbonamentoPush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  const supabase = await supabaseServer();
  const userId = await utenteId(supabase);
  if (!userId) return { ok: false };
  const { error } = await supabase.from("push_abbonamenti").upsert(
    { persona_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent },
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
  const userId = await utenteId(supabase);
  if (!userId) return;
  await supabase.from("deleghe").delete().eq("genitore_id", userId).eq("delegato_id", delegatoId);
  revalidatePath("/profilo");
}

/* Registrazione: chi sei (nome, cognome, genitore e/o volontario) e consenso, una volta sola. */
export async function registrati(nome: string, cognome: string, scuolaId: string, ruoli: RuoloTipo[], informativaId: string): Promise<{ ok: boolean; messaggio: string }> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("registrati", { p_nome: nome, p_cognome: cognome, p_scuola: scuolaId, p_ruoli: ruoli, p_informativa: informativaId });
  if (error) return { ok: false, messaggio: error.message };
  revalidatePath("/", "layout");
  return { ok: true, messaggio: "Registrazione fatta." };
}

/* Iscrizione dei bambini: una RPC per bambino; la fermata può mancare (la assegna l'admin). */
export type BambinoDaIscrivere = { nome: string; cognome: string; classe: string; genere: "F" | "M" | null; lineaId: string | null; fermataId: string | null };
export type ContattoEmergenza = { nome: string; relazione: string; telefono: string; ordine: number };
export async function iscriviBambini(scuolaId: string, informativaId: string, bambini: BambinoDaIscrivere[], contatti: ContattoEmergenza[]): Promise<{ ok: boolean; messaggio: string; iscritti: string[] }> {
  const supabase = await supabaseServer();
  const iscritti: string[] = [];
  for (const b of bambini) {
    const { error } = await supabase.rpc("iscrivi_bambino", {
      p_scuola: scuolaId, p_nome: b.nome.trim(), p_cognome: b.cognome.trim(), p_classe: b.classe, p_genere: b.genere,
      p_linea: b.lineaId, p_fermata: b.fermataId, p_informativa: informativaId, p_contatti: contatti,
    });
    if (error) return { ok: false, messaggio: error.message, iscritti };
    iscritti.push(b.nome.trim());
  }
  revalidatePath("/", "layout");
  return { ok: true, messaggio: "Iscrizione inviata.", iscritti };
}
