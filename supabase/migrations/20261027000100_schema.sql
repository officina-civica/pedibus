-- =============================================================================
-- Pedibus · schema
-- Una riga di contesto per tabella; le regole stanno in 20261027000200_regole.sql,
-- la visibilità per ruolo in 20261027000300_rls.sql.
-- Convenzioni: nomi italiani, snake_case, plurale; id uuid; orari in Europe/Rome.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type ruolo_tipo        as enum ('genitore', 'volontario', 'admin');
create type stato_approvazione as enum ('in_attesa', 'approvata', 'rifiutata');
create type stato_presenza    as enum ('presente', 'assente');
create type stato_turno       as enum (
  'programmato',          -- parte regolarmente
  'annullato_soglia',     -- alle 18:00 sotto soglia bambini; riattivabile fino alle 21:00
  'riattivato',           -- soglia raggiunta con una modifica tardiva
  'annullato_definitivo', -- alle 21:00 ancora sotto soglia
  'annullato_volontari',  -- un'ora prima della partenza volontari sotto il minimo
  'in_corso',             -- appello aperto
  'consegnato'            -- bambini consegnati a scuola
);
create type ruolo_turno       as enum ('titolare', 'backup');
create type stato_volontario_turno as enum ('assegnato', 'non_viene', 'copre');
create type stato_appello_bambino  as enum ('atteso', 'salito', 'non_trovato', 'aggiunto');
create type tipo_eccezione    as enum ('assente', 'presente');
create type tipo_dotazione    as enum ('kit', 'pettorina', 'paletta');
create type tipo_avviso       as enum ('info', 'ok', 'warn');
create type stato_bozza       as enum ('bozza', 'inviata', 'pubblicata');

-- ---------------------------------------------------------------------------
-- Territorio
-- ---------------------------------------------------------------------------
create table comuni (
  id      uuid primary key default gen_random_uuid(),
  nome    text not null unique
);
comment on table comuni is 'Il comune che patrocina il pedibus. Pronto per più comuni, oggi uno.';

create table scuole (
  id        uuid primary key default gen_random_uuid(),
  comune_id uuid not null references comuni(id),
  nome      text not null,
  unique (comune_id, nome)
);

-- Giorni senza pedibus (vacanze, scioperi, chiusure): niente turni, niente appelli.
create table calendario_chiusure (
  scuola_id uuid not null references scuole(id) on delete cascade,
  giorno    date not null,
  motivo    text not null,
  primary key (scuola_id, giorno)
);

create table linee (
  id                     uuid primary key default gen_random_uuid(),
  scuola_id              uuid not null references scuole(id),
  nome                   text not null,
  colore                 text not null default '#15803d',
  min_volontari          int  not null default 2 check (min_volontari >= 1),
  volontari_consigliati  int  not null default 3,
  soglia_bambini         int  not null default 4 check (soglia_bambini >= 1),
  ora_partenza           time not null,
  ora_arrivo             time not null default '08:00',
  ora_chiusura_assenze   time not null default '18:00',   -- della sera prima
  ora_soglia_definitiva  time not null default '21:00',   -- della sera prima
  attiva                 boolean not null default true,
  unique (scuola_id, nome)
);
comment on table linee is 'Una linea = un percorso con fermate, soglie e minimo volontari propri.';

create table fermate (
  id        uuid primary key default gen_random_uuid(),
  linea_id  uuid not null references linee(id) on delete cascade,
  ordine    int  not null,
  nome      text not null,
  orario    time not null,
  capolinea boolean not null default false,
  arrivo    boolean not null default false,
  unique (linea_id, ordine)
);

-- ---------------------------------------------------------------------------
-- Persone e ruoli
-- ---------------------------------------------------------------------------
-- persone.id coincide con auth.users.id: il profilo nasce al primo accesso.
create table persone (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  cognome    text not null,
  telefono   text,
  email      text,
  creato_il  timestamptz not null default now()
);

-- Un ruolo per scuola. Volontario e admin vanno approvati; il genitore è approvato
-- insieme alla prima iscrizione.
create table ruoli (
  persona_id   uuid not null references persone(id) on delete cascade,
  scuola_id    uuid not null references scuole(id),
  ruolo        ruolo_tipo not null,
  stato        stato_approvazione not null default 'in_attesa',
  note         text,                       -- es. verifica albo volontari civici
  richiesto_il timestamptz not null default now(),
  deciso_da    uuid references persone(id),
  deciso_il    timestamptz,
  primary key (persona_id, scuola_id, ruolo)
);

-- Versioni dell'informativa privacy: ogni iscrizione ricorda quale ha accettato.
create table informative (
  id         uuid primary key default gen_random_uuid(),
  versione   text not null unique,
  url        text,
  valida_dal date not null
);

-- ---------------------------------------------------------------------------
-- Bambini e iscrizioni
-- ---------------------------------------------------------------------------
create table bambini (
  id          uuid primary key default gen_random_uuid(),
  scuola_id   uuid not null references scuole(id),
  genitore_id uuid not null references persone(id),   -- genitore principale
  nome        text not null,
  cognome     text not null,
  classe      text not null,
  genere      char(1) check (genere in ('F', 'M')),   -- solo per gli accordi nei testi
  pettorina   text,
  creato_il   timestamptz not null default now()
);

-- L'iscrizione lega il bambino a linea e fermata per un anno scolastico.
-- Resta registrata con stato, chi ha deciso, quando, e l'informativa accettata.
create table iscrizioni (
  id             uuid primary key default gen_random_uuid(),
  bambino_id     uuid not null references bambini(id) on delete cascade,
  linea_id       uuid not null references linee(id),
  fermata_id     uuid not null references fermate(id),
  anno_scolastico text not null,                      -- '2026/27'
  stato          stato_approvazione not null default 'in_attesa',
  informativa_id uuid not null references informative(id),
  consenso_il    timestamptz not null default now(),
  richiesta_il   timestamptz not null default now(),
  decisa_da      uuid references persone(id),
  decisa_il      timestamptz,
  motivo_rifiuto text
);
create index iscrizioni_bambino_idx on iscrizioni(bambino_id, stato);
create index iscrizioni_linea_idx   on iscrizioni(linea_id, stato);
-- Una sola iscrizione approvata per bambino e anno.
create unique index iscrizioni_una_approvata
  on iscrizioni(bambino_id, anno_scolastico) where stato = 'approvata';

-- Il backup del genitore: può solo segnare presenze e assenze dei bambini del delegante.
create table deleghe (
  genitore_id uuid not null references persone(id) on delete cascade,
  delegato_id uuid not null references persone(id) on delete cascade,
  etichetta   text,                                     -- 'nonna Rita'
  creata_il   timestamptz not null default now(),
  primary key (genitore_id, delegato_id),
  check (genitore_id <> delegato_id)
);

-- Contatti d'emergenza: li vede solo il volontario di turno sulla linea del bambino,
-- e ogni consultazione resta registrata. Nessun dato sanitario, per scelta.
create table contatti_emergenza (
  id         uuid primary key default gen_random_uuid(),
  bambino_id uuid not null references bambini(id) on delete cascade,
  nome       text not null,
  relazione  text not null,
  telefono   text not null,
  ordine     int  not null default 1
);

create table accessi_contatti (
  id          bigint generated always as identity primary key,
  persona_id  uuid not null references persone(id),
  bambino_id  uuid not null references bambini(id),
  turno_id    uuid,                                     -- fk dopo la tabella turni
  consultato_il timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Volontari: disponibilità, eccezioni, dotazioni
-- ---------------------------------------------------------------------------
-- Settimana tipo: giorno 0 = lunedì … 4 = venerdì.
create table disponibilita (
  volontario_id uuid not null references persone(id) on delete cascade,
  giorno        smallint not null check (giorno between 0 and 4),
  primary key (volontario_id, giorno)
);

-- Un giorno diverso dal solito: 'assente' dove sarebbe disponibile, 'presente' dove no.
create table eccezioni_disponibilita (
  volontario_id uuid not null references persone(id) on delete cascade,
  giorno        date not null,
  tipo          tipo_eccezione not null,
  creata_il     timestamptz not null default now(),
  primary key (volontario_id, giorno)
);

create table dotazioni (
  id            uuid primary key default gen_random_uuid(),
  volontario_id uuid not null references persone(id) on delete cascade,
  tipo          tipo_dotazione not null,
  numero        text,
  consegnata_il date not null default current_date,
  restituita_il date
);

-- ---------------------------------------------------------------------------
-- Turni
-- ---------------------------------------------------------------------------
-- La bozza mensile: generata dall'algoritmo, inviata ai volontari, confermata per
-- silenzio-assenso. "stale" = una disponibilità è cambiata dopo la generazione.
create table bozze_turni (
  id           uuid primary key default gen_random_uuid(),
  scuola_id    uuid not null references scuole(id),
  mese         date not null,                           -- primo giorno del mese
  stato        stato_bozza not null default 'bozza',
  generata_il  timestamptz not null default now(),
  generata_da  uuid references persone(id),
  inviata_il   timestamptz,
  scadenza_silenzio_assenso date,
  pubblicata_il timestamptz,
  stale        boolean not null default false,
  unique (scuola_id, mese)
);

-- Un turno = una linea in un giorno di scuola. Lo stato racconta la giornata.
create table turni (
  id                  uuid primary key default gen_random_uuid(),
  linea_id            uuid not null references linee(id),
  giorno              date not null,
  stato               stato_turno not null default 'programmato',
  presenti_attesi     int,                               -- fotografato alle 18:00
  motivo              text,
  escalation_dal      timestamptz,                       -- primo "non posso venire" non coperto
  escalation_allargata_il timestamptz,                   -- avviso esteso a tutti i volontari (dopo 10 minuti)
  bozza_id            uuid references bozze_turni(id),
  aggiornato_il       timestamptz not null default now(),
  unique (linea_id, giorno)
);
create index turni_giorno_idx on turni(giorno);

alter table accessi_contatti
  add constraint accessi_contatti_turno_fk foreign key (turno_id) references turni(id);

create table turni_volontari (
  turno_id      uuid not null references turni(id) on delete cascade,
  volontario_id uuid not null references persone(id),
  ruolo         ruolo_turno not null default 'titolare',
  stato         stato_volontario_turno not null default 'assegnato',
  aggiornato_il timestamptz not null default now(),
  primary key (turno_id, volontario_id)
);

-- ---------------------------------------------------------------------------
-- Presenze
-- ---------------------------------------------------------------------------
-- Presenti salvo avviso: una riga esiste solo se qualcuno ha segnato qualcosa.
-- Nessuna riga = presente. 'tardiva' = segnata dopo la chiusura delle assenze.
create table presenze (
  bambino_id uuid not null references bambini(id) on delete cascade,
  giorno     date not null,
  stato      stato_presenza not null,
  tardiva    boolean not null default false,
  segnata_da uuid not null references persone(id),
  segnata_il timestamptz not null default now(),
  primary key (bambino_id, giorno)
);
create index presenze_giorno_idx on presenze(giorno);

-- ---------------------------------------------------------------------------
-- Appello
-- ---------------------------------------------------------------------------
create table appelli (
  id               uuid primary key default gen_random_uuid(),
  turno_id         uuid not null unique references turni(id) on delete cascade,
  aperto_da        uuid not null references persone(id),
  aperto_il        timestamptz not null default now(),
  fermata_corrente uuid references fermate(id),
  consegnato_il    timestamptz,
  consegnato_da    uuid references persone(id)
);

create table appello_bambini (
  appello_id uuid not null references appelli(id) on delete cascade,
  bambino_id uuid not null references bambini(id),
  stato      stato_appello_bambino not null default 'atteso',
  fermata_id uuid references fermate(id),
  segnato_da uuid references persone(id),
  segnato_il timestamptz,
  primary key (appello_id, bambino_id)
);

-- ---------------------------------------------------------------------------
-- Avvisi
-- ---------------------------------------------------------------------------
-- Ogni avviso è per una persona. Push sempre; sms = anche via SMS (urgenti).
-- L'invio effettivo (push/SMS) è a carico di una Edge Function che legge inviato_il nulli.
create table avvisi (
  id              bigint generated always as identity primary key,
  destinatario_id uuid not null references persone(id) on delete cascade,
  tipo            tipo_avviso not null default 'info',
  titolo          text not null,
  corpo           text not null,
  sms             boolean not null default false,
  linea_id        uuid references linee(id),
  turno_id        uuid references turni(id),
  creato_il       timestamptz not null default now(),
  letto_il        timestamptz,
  inviato_push_il timestamptz,
  inviato_sms_il  timestamptz
);
create index avvisi_destinatario_idx on avvisi(destinatario_id, creato_il desc);
create index avvisi_da_inviare_idx on avvisi(creato_il) where inviato_push_il is null;

-- ---------------------------------------------------------------------------
-- Trigger di manutenzione
-- ---------------------------------------------------------------------------
create or replace function tocca_aggiornato_il() returns trigger
language plpgsql as $$
begin
  new.aggiornato_il := now();
  return new;
end $$;

create trigger turni_tocca before update on turni
  for each row execute function tocca_aggiornato_il();
create trigger turni_volontari_tocca before update on turni_volontari
  for each row execute function tocca_aggiornato_il();

-- Il profilo nasce quando nasce l'utente in auth (nome/cognome dai metadati di signup).
create or replace function crea_profilo_da_auth() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into persone (id, nome, cognome, telefono, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    coalesce(new.raw_user_meta_data ->> 'cognome', ''),
    new.phone,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger auth_utente_creato
  after insert on auth.users
  for each row execute function crea_profilo_da_auth();
