-- =============================================================================
-- Pedibus · chi vede cosa (Row Level Security)
-- La visibilità segue i dati, non le schermate. Regole, dai Requisiti:
--  · Genitore: solo le linee su cui ha bambini con iscrizione approvata; conteggi
--    e volontari di turno, mai nomi di altri bambini. Eccezione: linee e fermate
--    sono pubbliche, servono per iscriversi.
--  · Backup del genitore (delega): solo presenze dei bambini delegati.
--  · Volontario: i bambini della propria linea solo il giorno del proprio turno;
--    i contatti d'emergenza solo tramite RPC che registra la consultazione.
--  · Amministratore: tutto, nella propria scuola.
-- Le scritture che hanno regole (presenze, appello, escalation, decisioni) passano
-- dalle RPC security definer: qui si aprono solo le scritture "semplici".
-- =============================================================================

-- "Oggi" in Europe/Rome, sovrascrivibile nei test con set pedibus.oggi = '2026-10-27'.
create or replace function oggi_rome() returns date
language sql stable as $$
  select coalesce(nullif(current_setting('pedibus.oggi', true), '')::date, (now() at time zone 'Europe/Rome')::date)
$$;

-- Le scuole in cui sono volontario approvato.
create or replace function mie_scuole_volontario() returns setof uuid
language sql stable security definer set search_path = public as $$
  select r.scuola_id from ruoli r where r.persona_id = auth.uid() and r.ruolo = 'volontario' and r.stato = 'approvata'
$$;

-- Un volontario vede un bambino solo se oggi è di turno sulla sua linea.
create or replace function vedo_bambino_di_turno(p_bambino uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from iscrizioni i
    join turni t on t.linea_id = i.linea_id and t.giorno = oggi_rome()
    join turni_volontari tv on tv.turno_id = t.id and tv.volontario_id = auth.uid()
    where i.bambino_id = p_bambino and i.stato = 'approvata'
      and ((tv.ruolo = 'titolare' and tv.stato <> 'non_viene') or tv.stato = 'copre'))
$$;

-- ---------------------------------------------------------------------------
-- Pubblico (anche anonimo): il territorio e l'informativa, per potersi iscrivere.
-- ---------------------------------------------------------------------------
alter table comuni enable row level security;
alter table scuole enable row level security;
alter table linee enable row level security;
alter table fermate enable row level security;
alter table calendario_chiusure enable row level security;
alter table informative enable row level security;

create policy comuni_lettura on comuni for select to anon, authenticated using (true);
create policy scuole_lettura on scuole for select to anon, authenticated using (true);
create policy linee_lettura on linee for select to anon, authenticated using (true);
create policy fermate_lettura on fermate for select to anon, authenticated using (true);
create policy calendario_lettura on calendario_chiusure for select to anon, authenticated using (true);
create policy informative_lettura on informative for select to anon, authenticated using (true);

create policy linee_admin on linee for all to authenticated
  using (is_admin(scuola_id)) with check (is_admin(scuola_id));
create policy fermate_admin on fermate for all to authenticated
  using (is_admin(scuola_di_linea(linea_id))) with check (is_admin(scuola_di_linea(linea_id)));
create policy calendario_admin on calendario_chiusure for all to authenticated
  using (is_admin(scuola_id)) with check (is_admin(scuola_id));
create policy informative_admin on informative for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Persone e ruoli
-- ---------------------------------------------------------------------------
alter table persone enable row level security;
alter table ruoli enable row level security;

-- Me stesso; l'admin tutti; un volontario i colleghi volontari della stessa scuola.
create policy persone_lettura on persone for select to authenticated
  using (
    id = auth.uid()
    or is_admin()
    or exists (select 1 from ruoli r where r.persona_id = persone.id and r.ruolo = 'volontario' and r.stato = 'approvata'
               and r.scuola_id in (select mie_scuole_volontario()))
  );
create policy persone_modifica on persone for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

create policy ruoli_lettura on ruoli for select to authenticated
  using (persona_id = auth.uid() or is_admin(scuola_id));
-- Chiedere un ruolo per sé: nasce sempre in attesa.
create policy ruoli_richiesta on ruoli for insert to authenticated
  with check (persona_id = auth.uid() and stato = 'in_attesa');
create policy ruoli_admin on ruoli for update to authenticated
  using (is_admin(scuola_id)) with check (is_admin(scuola_id));

-- ---------------------------------------------------------------------------
-- Bambini, iscrizioni, deleghe, contatti
-- ---------------------------------------------------------------------------
alter table bambini enable row level security;
alter table iscrizioni enable row level security;
alter table deleghe enable row level security;
alter table contatti_emergenza enable row level security;
alter table accessi_contatti enable row level security;

create policy bambini_lettura on bambini for select to authenticated
  using (id in (select miei_bambini()) or is_admin(scuola_id) or vedo_bambino_di_turno(id));
create policy bambini_modifica on bambini for update to authenticated
  using (genitore_id = auth.uid() or is_admin(scuola_id)) with check (genitore_id = auth.uid() or is_admin(scuola_id));

create policy iscrizioni_lettura on iscrizioni for select to authenticated
  using (bambino_id in (select miei_bambini()) or is_admin(scuola_di_linea(linea_id)));

create policy deleghe_lettura on deleghe for select to authenticated
  using (genitore_id = auth.uid() or delegato_id = auth.uid() or is_admin());
create policy deleghe_gestione on deleghe for insert to authenticated with check (genitore_id = auth.uid());
create policy deleghe_revoca on deleghe for delete to authenticated using (genitore_id = auth.uid());

-- I contatti li gestisce il genitore e li vede l'admin; il volontario solo via contatti_emergenza_turno().
create policy contatti_lettura on contatti_emergenza for select to authenticated
  using (exists (select 1 from bambini b where b.id = bambino_id and (b.genitore_id = auth.uid() or is_admin(b.scuola_id))));
create policy contatti_gestione on contatti_emergenza for all to authenticated
  using (exists (select 1 from bambini b where b.id = bambino_id and b.genitore_id = auth.uid()))
  with check (exists (select 1 from bambini b where b.id = bambino_id and b.genitore_id = auth.uid()));

-- Il registro delle consultazioni lo vede il genitore per i propri bambini e l'admin.
create policy accessi_lettura on accessi_contatti for select to authenticated
  using (exists (select 1 from bambini b where b.id = bambino_id and (b.genitore_id = auth.uid() or is_admin(b.scuola_id))));

-- ---------------------------------------------------------------------------
-- Volontari: disponibilità, eccezioni, dotazioni
-- ---------------------------------------------------------------------------
alter table disponibilita enable row level security;
alter table eccezioni_disponibilita enable row level security;
alter table dotazioni enable row level security;

create policy disponibilita_mie on disponibilita for all to authenticated
  using (volontario_id = auth.uid()) with check (volontario_id = auth.uid());
create policy disponibilita_admin on disponibilita for select to authenticated using (is_admin());
create policy eccezioni_mie on eccezioni_disponibilita for all to authenticated
  using (volontario_id = auth.uid()) with check (volontario_id = auth.uid());
create policy eccezioni_admin on eccezioni_disponibilita for select to authenticated using (is_admin());
create policy dotazioni_mie on dotazioni for select to authenticated using (volontario_id = auth.uid());
create policy dotazioni_admin on dotazioni for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Turni
-- ---------------------------------------------------------------------------
alter table bozze_turni enable row level security;
alter table turni enable row level security;
alter table turni_volontari enable row level security;

create policy bozze_lettura on bozze_turni for select to authenticated
  using (is_admin(scuola_id) or scuola_id in (select mie_scuole_volontario()));
create policy bozze_admin on bozze_turni for all to authenticated
  using (is_admin(scuola_id)) with check (is_admin(scuola_id));

-- Il genitore vede lo stato dei turni solo sulle linee dei suoi bambini.
create policy turni_lettura on turni for select to authenticated
  using (
    linea_id in (select mie_linee())
    or is_admin(scuola_di_linea(linea_id))
    or scuola_di_linea(linea_id) in (select mie_scuole_volontario())
  );
create policy turni_admin on turni for all to authenticated
  using (is_admin(scuola_di_linea(linea_id))) with check (is_admin(scuola_di_linea(linea_id)));

-- Chi è di turno lo vedono i volontari della scuola e l'admin, non i genitori.
create policy turni_volontari_lettura on turni_volontari for select to authenticated
  using (exists (select 1 from turni t where t.id = turno_id
                 and (is_admin(scuola_di_linea(t.linea_id)) or scuola_di_linea(t.linea_id) in (select mie_scuole_volontario()))));
create policy turni_volontari_admin on turni_volontari for all to authenticated
  using (exists (select 1 from turni t where t.id = turno_id and is_admin(scuola_di_linea(t.linea_id))))
  with check (exists (select 1 from turni t where t.id = turno_id and is_admin(scuola_di_linea(t.linea_id))));

-- ---------------------------------------------------------------------------
-- Presenze e appello
-- ---------------------------------------------------------------------------
alter table presenze enable row level security;
alter table appelli enable row level security;
alter table appello_bambini enable row level security;

create policy presenze_lettura on presenze for select to authenticated
  using (bambino_id in (select miei_bambini())
         or exists (select 1 from bambini b where b.id = bambino_id and is_admin(b.scuola_id)));
-- Scrittura solo via segna_presenza(): applica tardività e soglie.

create policy appelli_lettura on appelli for select to authenticated
  using (di_turno(turno_id) or exists (select 1 from turni t where t.id = turno_id and is_admin(scuola_di_linea(t.linea_id))));

create policy appello_bambini_lettura on appello_bambini for select to authenticated
  using (
    bambino_id in (select miei_bambini())
    or exists (select 1 from appelli a where a.id = appello_id and di_turno(a.turno_id))
    or exists (select 1 from bambini b where b.id = bambino_id and is_admin(b.scuola_id))
  );

-- ---------------------------------------------------------------------------
-- Avvisi: ognuno i propri. Segnare come letto è l'unica scrittura.
-- ---------------------------------------------------------------------------
alter table avvisi enable row level security;
create policy avvisi_miei on avvisi for select to authenticated using (destinatario_id = auth.uid());
create policy avvisi_letto on avvisi for update to authenticated
  using (destinatario_id = auth.uid()) with check (destinatario_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Funzioni interne e job: non chiamabili dall'app (solo dal database e dai job).
-- ---------------------------------------------------------------------------
revoke execute on function
  turno_del(uuid, date), valuta_soglia(uuid, date, timestamptz),
  avvisa(uuid, tipo_avviso, text, text, boolean, uuid, uuid, timestamptz),
  avvisa_genitori_linea(uuid, tipo_avviso, text, text, boolean, uuid, timestamptz),
  avvisa_volontari_turno(uuid, tipo_avviso, text, text, boolean, uuid, timestamptz),
  avvisa_admin(uuid, tipo_avviso, text, text, boolean, uuid, uuid, timestamptz),
  chiudi_assenze(date, timestamptz), soglia_definitiva(date, timestamptz),
  allarga_escalation(timestamptz), controllo_volontari(date, timestamptz),
  crea_profilo_da_auth(), tocca_aggiornato_il()
from public, anon, authenticated;

-- Le RPC non hanno senso per gli anonimi.
revoke execute on function
  segna_presenza(uuid, stato_presenza, date, timestamptz),
  non_posso_venire(uuid, timestamptz), copro_turno(uuid, timestamptz),
  apri_appello(uuid, timestamptz), segna_salito(uuid, uuid, boolean, timestamptz),
  aggiungi_all_appello(uuid, uuid, timestamptz), prossima_fermata(uuid, timestamptz), consegna(uuid, timestamptz),
  contatti_emergenza_turno(uuid, timestamptz),
  decidi_iscrizione(uuid, stato_approvazione, text, timestamptz), decidi_ruolo(uuid, uuid, ruolo_tipo, stato_approvazione, text, timestamptz),
  imposta_disponibilita(smallint[]), segna_eccezione(date, tipo_eccezione, timestamptz),
  genera_bozza(uuid, date, timestamptz), invia_bozza(uuid, timestamptz), pubblica_bozza(uuid, timestamptz),
  iscrivi_bambino(uuid, text, text, text, char, uuid, uuid, uuid, jsonb, timestamptz)
from anon;
