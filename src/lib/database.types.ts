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
export type RuoloTurno = "titolare" | "backup";
export type StatoVolontarioTurno = "assegnato" | "non_viene" | "copre";
export type StatoAppelloBambino = "atteso" | "salito" | "non_trovato" | "aggiunto";
export type TipoEccezione = "assente" | "presente";
export type StatoBozza = "bozza" | "inviata" | "pubblicata";

export type Disponibilita = { volontario_id: string; giorno: number };
export type EccezioneDisponibilita = { volontario_id: string; giorno: string; tipo: TipoEccezione; creata_il: string };
export type Dotazione = { id: string; volontario_id: string; tipo: "kit" | "pettorina" | "paletta"; numero: string | null; consegnata_il: string; restituita_il: string | null };
export type BozzaTurni = { id: string; scuola_id: string; mese: string; stato: StatoBozza; generata_il: string; generata_da: string | null; inviata_il: string | null; scadenza_silenzio_assenso: string | null; pubblicata_il: string | null; stale: boolean };
export type TurnoVolontario = { turno_id: string; volontario_id: string; ruolo: RuoloTurno; stato: StatoVolontarioTurno; aggiornato_il: string };
export type CalendarioChiusura = { scuola_id: string; giorno: string; motivo: string };

export type TurnoDettaglio = {
  id: string; giorno: string; stato: StatoTurno; motivo: string | null;
  linea: { id: string; nome: string; colore: string; ora_partenza: string; min_volontari: number; soglia_bambini: number };
  capolinea: string | null; attesi: number; copertura: number; kit_presente: boolean;
  escalation_dal: string | null; escalation_allargata_il: string | null;
  appello: { id: string; aperto_il: string; consegnato_il: string | null } | null;
  volontari: { id: string; nome: string; ruolo: RuoloTurno; stato: StatoVolontarioTurno; kit: boolean; sono_io: boolean }[];
  backup_disponibili: { id: string; nome: string; kit: boolean }[];
};
export type MioTurno = { turno_id: string; giorno: string; linea_id: string; linea_nome: string; colore: string; ora_partenza: string; ruolo: RuoloTurno; stato_mio: StatoVolontarioTurno; stato_turno: StatoTurno; copertura: number; min_volontari: number };
export type FermataAnteprima = { fermata_id: string; ordine: number; nome: string; orario: string; capolinea: boolean; arrivo: boolean; attesi: number };
export type AppelloStato = {
  id: string; aperto_il: string; consegnato_il: string | null;
  fermata_corrente: { id: string; ordine: number; nome: string; orario: string; arrivo: boolean } | null;
  fermate: number;
  bambini: { id: string; nome: string; classe: string; stato: StatoAppelloBambino; fermata_id: string | null; fermata_ordine: number | null; tardiva: boolean }[];
  aggiungibili: { id: string; nome: string; classe: string }[];
  volontari: string; kit_presente: boolean;
};
export type RiepilogoAdmin = {
  giorno: string; iscrizioni_in_attesa: number; ruoli_in_attesa: number;
  bozza: { id: string; mese: string; stato: StatoBozza; stale: boolean; inviata_il: string | null; scadenza: string | null } | null;
  linee: { id: string; nome: string; colore: string; ora_partenza: string; soglia_bambini: number; min_volontari: number; turno_id: string | null; stato: StatoTurno; motivo: string | null;
           presenti: number; iscritti: number; copertura: number; kit_presente: boolean; volontari: string; escalation_dal: string | null; escalation_allargata_il: string | null; mancanti: string; consegnato_alle: string | null }[];
};
export type ContattoTurno = { bambino_id: string; bambino: string; nome: string; relazione: string; telefono: string };

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
      disponibilita: Tabella<Disponibilita>;
      eccezioni_disponibilita: Tabella<EccezioneDisponibilita>;
      dotazioni: Tabella<Dotazione>;
      bozze_turni: Tabella<BozzaTurni>;
      turni_volontari: Tabella<TurnoVolontario>;
      calendario_chiusure: Tabella<CalendarioChiusura>;
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
      turno_dettaglio: { Args: { p_turno: string }; Returns: TurnoDettaglio };
      miei_turni: { Args: { p_da: string; p_a: string }; Returns: MioTurno[] };
      mio_prossimo_turno: { Args: Record<string, never>; Returns: string | null };
      mio_turno_oggi: { Args: Record<string, never>; Returns: string | null };
      appello_anteprima: { Args: { p_turno: string }; Returns: FermataAnteprima[] };
      appello_stato: { Args: { p_turno: string }; Returns: AppelloStato | null };
      riepilogo_admin: { Args: { p_giorno?: string | null }; Returns: RiepilogoAdmin };
      turni_del_giorno: { Args: { p_giorno: string }; Returns: TurnoDettaglio[] };
      non_posso_venire: { Args: { p_turno: string }; Returns: string };
      copro_turno: { Args: { p_turno: string }; Returns: string };
      apri_appello: { Args: { p_turno: string }; Returns: string };
      segna_salito: { Args: { p_appello: string; p_bambino: string; p_salito?: boolean }; Returns: undefined };
      aggiungi_all_appello: { Args: { p_appello: string; p_bambino: string }; Returns: undefined };
      prossima_fermata: { Args: { p_appello: string }; Returns: string };
      consegna: { Args: { p_appello: string }; Returns: undefined };
      contatti_emergenza_turno: { Args: { p_turno: string }; Returns: ContattoTurno[] };
      decidi_iscrizione: { Args: { p_iscrizione: string; p_stato: StatoApprovazione; p_motivo?: string | null }; Returns: undefined };
      decidi_ruolo: { Args: { p_persona: string; p_scuola: string; p_ruolo: RuoloTipo; p_stato: StatoApprovazione; p_note?: string | null }; Returns: undefined };
      imposta_disponibilita: { Args: { p_giorni: number[] }; Returns: undefined };
      segna_eccezione: { Args: { p_giorno: string; p_tipo: TipoEccezione | null }; Returns: string };
      genera_bozza: { Args: { p_scuola: string; p_mese: string }; Returns: string };
      invia_bozza: { Args: { p_bozza: string }; Returns: undefined };
      pubblica_bozza: { Args: { p_bozza: string }; Returns: undefined };
      aggiungi_delega: { Args: { p_telefono: string; p_etichetta?: string | null }; Returns: string };
      iscrivi_bambino: { Args: { p_scuola: string; p_nome: string; p_cognome: string; p_classe: string; p_genere: string | null; p_linea: string; p_fermata: string; p_informativa: string; p_contatti?: unknown }; Returns: string };
    };
    Enums: {
      stato_presenza: StatoPresenza; stato_turno: StatoTurno; ruolo_tipo: RuoloTipo; stato_approvazione: StatoApprovazione; tipo_avviso: TipoAvviso;
    };
    CompositeTypes: Record<string, never>;
  };
};
