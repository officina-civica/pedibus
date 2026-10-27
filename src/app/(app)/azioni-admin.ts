"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import type { RuoloTipo, StatoApprovazione } from "@/lib/database.types";

type Esito = { ok: boolean; messaggio: string };
const esito = (error: { message: string } | null, msg: string, paths: string[]): Esito => {
  if (error) return { ok: false, messaggio: error.message };
  paths.forEach((p) => revalidatePath(p));
  return { ok: true, messaggio: msg };
};

export async function decidiIscrizione(iscrizioneId: string, stato: StatoApprovazione, motivo?: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("decidi_iscrizione", { p_iscrizione: iscrizioneId, p_stato: stato, p_motivo: motivo ?? null });
  return esito(error, stato === "approvata" ? "Iscrizione approvata, notifica inviata." : "Iscrizione rifiutata.", ["/iscrizioni", "/oggi"]);
}

export async function decidiRuolo(personaId: string, scuolaId: string, ruolo: RuoloTipo, stato: StatoApprovazione, note?: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("decidi_ruolo", { p_persona: personaId, p_scuola: scuolaId, p_ruolo: ruolo, p_stato: stato, p_note: note ?? null });
  return esito(error, stato === "approvata" ? "Ruolo approvato." : "Richiesta rifiutata.", ["/iscrizioni", "/oggi"]);
}

export async function generaBozza(scuolaId: string, mese: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("genera_bozza", { p_scuola: scuolaId, p_mese: mese });
  return esito(error, "Bozza generata: da rivedere.", ["/turni", "/oggi"]);
}

export async function inviaBozza(bozzaId: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("invia_bozza", { p_bozza: bozzaId });
  return esito(error, "Bozza inviata ai volontari: silenzio-assenso alla scadenza.", ["/turni", "/oggi"]);
}

export async function pubblicaBozza(bozzaId: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("pubblica_bozza", { p_bozza: bozzaId });
  return esito(error, "Turni pubblicati.", ["/turni", "/oggi"]);
}
