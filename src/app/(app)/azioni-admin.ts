"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import type { CanaleChiave, RuoloTipo, StatoApprovazione } from "@/lib/database.types";

type Esito = { ok: boolean; messaggio: string };
const esito = (error: { message: string } | null, msg: string, paths: string[]): Esito => {
  if (error) return { ok: false, messaggio: error.message };
  paths.forEach((p) => revalidatePath(p));
  return { ok: true, messaggio: msg };
};

export async function decidiIscrizione(iscrizioneId: string, stato: StatoApprovazione, motivo?: string, assegna?: { lineaId: string; fermataId: string }): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("decidi_iscrizione", { p_iscrizione: iscrizioneId, p_stato: stato, p_motivo: motivo ?? null, p_linea: assegna?.lineaId ?? null, p_fermata: assegna?.fermataId ?? null });
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

export async function impostaCanale(chiave: CanaleChiave, valore: boolean): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("imposta_canale", { p_chiave: chiave, p_valore: valore });
  return esito(error, valore ? "Canale attivato." : "Canale spento.", ["/profilo", "/avvisi"]);
}

/* Linee e fermate: le regole (ordine, capolinea/arrivo, sospensione con avvisi) stanno nelle RPC. */
export type DatiLinea = {
  nome: string; colore: string; oraPartenza: string; oraArrivo: string;
  sogliaBambini: number; minVolontari: number; volontariConsigliati: number;
  oraChiusuraAssenze: string; oraSogliaDefinitiva: string;
};
export async function salvaLinea(scuolaId: string, dati: DatiLinea, lineaId?: string): Promise<Esito & { id?: string }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("salva_linea", {
    p_scuola: scuolaId, p_nome: dati.nome, p_colore: dati.colore, p_ora_partenza: dati.oraPartenza, p_ora_arrivo: dati.oraArrivo,
    p_soglia_bambini: dati.sogliaBambini, p_min_volontari: dati.minVolontari, p_volontari_consigliati: dati.volontariConsigliati,
    p_ora_chiusura_assenze: dati.oraChiusuraAssenze, p_ora_soglia_definitiva: dati.oraSogliaDefinitiva, p_id: lineaId ?? null,
  });
  return { ...esito(error, lineaId ? "Linea aggiornata." : "Linea creata: aggiungi le fermate.", ["/linee", "/oggi", "/turni"]), id: data ?? undefined };
}

export async function sospendiLinea(lineaId: string, attiva: boolean, motivo?: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("sospendi_linea", { p_linea: lineaId, p_attiva: attiva, p_motivo: motivo ?? null });
  const n = typeof data === "number" ? data : 0;
  return esito(error, attiva ? "Linea riattivata: famiglie avvisate. Rigenera la bozza dei turni." : `Linea sospesa${n ? `, ${n} turni annullati` : ""}: famiglie e volontari avvisati.`, ["/linee", "/oggi", "/turni", "/presenze"]);
}

export async function salvaFermata(lineaId: string, nome: string, orario: string, fermataId?: string, dopoId?: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("salva_fermata", { p_linea: lineaId, p_nome: nome, p_orario: orario, p_id: fermataId ?? null, p_dopo: dopoId ?? null });
  return esito(error, fermataId ? "Fermata aggiornata." : "Fermata aggiunta.", ["/linee"]);
}

export async function eliminaFermata(fermataId: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("elimina_fermata", { p_id: fermataId });
  return esito(error, "Fermata eliminata.", ["/linee"]);
}

export async function spostaFermata(fermataId: string, su: boolean): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("sposta_fermata", { p_id: fermataId, p_su: su });
  return esito(error, "Ordine aggiornato.", ["/linee"]);
}

export async function salvaChiusura(scuolaId: string, giorno: string, motivo: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("salva_chiusura", { p_scuola: scuolaId, p_giorno: giorno, p_motivo: motivo });
  return esito(error, "Giorno senza pedibus aggiunto.", ["/linee", "/turni"]);
}

export async function eliminaChiusura(scuolaId: string, giorno: string): Promise<Esito> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("elimina_chiusura", { p_scuola: scuolaId, p_giorno: giorno });
  return esito(error, "Giorno tolto dal calendario.", ["/linee", "/turni"]);
}
