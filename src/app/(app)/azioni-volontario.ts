"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import type { TipoEccezione } from "@/lib/database.types";

type Esito = { ok: boolean; messaggio: string };
const esito = (error: { message: string } | null, msg?: string | null, path?: string): Esito => {
  if (error) return { ok: false, messaggio: traduci(error.message) };
  if (path) revalidatePath(path);
  return { ok: true, messaggio: msg ?? "Fatto." };
};

export async function nonPossoVenire(turnoId: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("non_posso_venire", { p_turno: turnoId });
  return esito(error, data, "/turni");
}

export async function coproTurno(turnoId: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("copro_turno", { p_turno: turnoId });
  return esito(error, data, "/turni");
}

export async function apriAppello(turnoId: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("apri_appello", { p_turno: turnoId });
  return esito(error, "Appello aperto al capolinea.", "/appello");
}

export async function segnaSalito(appelloId: string, bambinoId: string, salito: boolean): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("segna_salito", { p_appello: appelloId, p_bambino: bambinoId, p_salito: salito });
  return esito(error, null, "/appello");
}

export async function aggiungiAllAppello(appelloId: string, bambinoId: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("aggiungi_all_appello", { p_appello: appelloId, p_bambino: bambinoId });
  return esito(error, "Aggiunto: presente con nota.", "/appello");
}

export async function prossimaFermata(appelloId: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("prossima_fermata", { p_appello: appelloId });
  return esito(error, null, "/appello");
}

export async function consegnaAScuola(appelloId: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("consegna", { p_appello: appelloId });
  return esito(error, "Consegna confermata: genitori avvisati.", "/appello");
}

export async function contattiEmergenza(turnoId: string) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("contatti_emergenza_turno", { p_turno: turnoId });
  return { ok: !error, contatti: data ?? [], messaggio: error ? traduci(error.message) : "" };
}

export async function impostaDisponibilita(giorni: number[]): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("imposta_disponibilita", { p_giorni: giorni });
  return esito(error, "Disponibilità salvata.", "/profilo");
}

export async function segnaEccezione(giorno: string, tipo: TipoEccezione | null): Promise<Esito> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("segna_eccezione", { p_giorno: giorno, p_tipo: tipo });
  return esito(error, data, "/profilo");
}

function traduci(m: string) {
  return m.replace(/^.*?:\s*/, "") || m;
}
