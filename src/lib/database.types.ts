/* Tipi minimi del database, scritti a mano per la parte che l'app usa oggi.
   Quando il progetto è collegato: `npx supabase gen types typescript --linked > src/lib/database.types.ts`
   li sostituisce con quelli completi (stessa forma). */

export type StatoPresenza = "presente" | "assente";
export type StatoTurno =
  | "programmato" | "annullato_soglia" | "riattivato" | "annullato_definitivo"
  | "annullato_volontari" | "in_corso" | "consegnato";
export type RuoloTipo = "genitore" | "volontario" | "admin";
export type StatoApprovazione = "in_attesa" | "approvata" | "rifiutata";
export type TipoAvviso = "info" | "ok" | "warn";

export type Persona = { id: string; nome: string; cognome: string; telefono: string | null; email: string | null; creato_il: string };
export type Ruolo = { persona_id: string; scuola_id: string; ruolo: RuoloTipo; stato: StatoApprovazione; note: string | null; richiesto_il: string; deciso_il: string | null };
export type Scuola = { id: string; comune_id: string; nome: string };
export type Linea = {
  id: string; scuola_id: string; nome: string; colore: string; min_volontari: number; volontari_consigliati: number;
  soglia_bambini: number; ora_partenza: string; ora_arrivo: string; ora_chiusura_assenze: string; ora_soglia_definitiva: string; attiva: boolean;
};
export type Fermata = { id: string; linea_id: string; ordine: number; nome: string; orario: string; capolinea: boolean; arrivo: boolean };
export type Bambino = { id: string; scuola_id: string; genitore_id: string; nome: string; cognome: string; classe: string; genere: "F" | "M" | null; pettorina: string | null; creato_il: string };
export type Iscrizione = {
  id: string; bambino_id: string; linea_id: string; fermata_id: string; anno_scolastico: string; stato: StatoApprovazione;
  informativa_id: string; consenso_il: string; richiesta_il: string; decisa_da: string | null; decisa_il: string | null; motivo_rifiuto: string | null;
};
export type Informativa = { id: string; versione: string; url: string | null; valida_dal: string };
export type Delega = { genitore_id: string; delegato_id: string; etichetta: string | null; creata_il: string };
export type ContattoEmergenza = { id: string; bambino_id: string; nome: string; relazione: string; telefono: string; ordine: number };
export type Turno = {
  id: string; linea_id: string; giorno: string; stato: StatoTurno; presenti_attesi: number | null; motivo: string | null;
  escalation_dal: string | null; escalation_allargata_il: string | null; bozza_id: string | null; aggiornato_il: string;
};
export type Presenza = { bambino_id: string; giorno: string; stato: StatoPresenza; tardiva: boolean; segnata_da: string; segnata_il: string };
export type Avviso = {
  id: number; destinatario_id: string; tipo: TipoAvviso; titolo: string; corpo: string; sms: boolean; linea_id: string | null; turno_id: string | null;
  creato_il: string; letto_il: string | null; inviato_push_il: string | null; inviato_sms_il: string | null;
  push_esito: string | null; sms_esito: string | null; tentativi: number; prossimo_tentativo: string | null;
};
export type StatoLinea = {
  linea_id: string; nome: string; colore: string; soglia_bambini: number; ora_partenza: string; ora_chiusura_assenze: string;
  ora_soglia_definitiva: string; giorno: string; stato: StatoTurno; presenti: number; consegnato_alle: string | null;
};
export type PushAbbonamento = { id: string; persona_id: string; endpoint: string; p256dh: string; auth: string; user_agent: string | null; creato_il: string; ultimo_uso: string | null; fallito_il: string | null };

type Tabella<R, I = Partial<R>, U = Partial<R>> = { Row: R; Insert: I; Update: U; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      persone: Tabella<Persona>;
      ruoli: Tabella<Ruolo>;
      scuole: Tabella<Scuola>;
      linee: Tabella<Linea>;
      fermate: Tabella<Fermata>;
      bambini: Tabella<Bambino>;
      iscrizioni: Tabella<Iscrizione>;
      informative: Tabella<Informativa>;
      deleghe: Tabella<Delega>;
      contatti_emergenza: Tabella<ContattoEmergenza>;
      turni: Tabella<Turno>;
      presenze: Tabella<Presenza>;
      avvisi: Tabella<Avviso>;
      push_abbonamenti: Tabella<PushAbbonamento, { persona_id: string; endpoint: string; p256dh: string; auth: string; user_agent?: string | null }>;
    };
    Views: Record<string, never>;
    Functions: {
      giorno_riferimento: { Args: { p_scuola: string; p_at?: string }; Returns: string };
      segna_presenza: { Args: { p_bambino: string; p_stato: StatoPresenza; p_giorno?: string | null; p_at?: string }; Returns: string };
      presenti_attesi: { Args: { p_linea: string; p_giorno: string }; Returns: number };
      is_admin: { Args: { p_scuola?: string | null }; Returns: boolean };
      is_volontario: { Args: { p_scuola?: string | null }; Returns: boolean };
      mio_giorno_riferimento: { Args: Record<string, never>; Returns: string };
      stato_mie_linee: { Args: { p_giorno?: string | null }; Returns: StatoLinea[] };
    };
    Enums: {
      stato_presenza: StatoPresenza; stato_turno: StatoTurno; ruolo_tipo: RuoloTipo; stato_approvazione: StatoApprovazione; tipo_avviso: TipoAvviso;
    };
    CompositeTypes: Record<string, never>;
  };
};
