-- =============================================================================
-- Pedibus · cancellazione automatica dei dati (tempi dell'informativa 1.0)
--
-- Due tempi, perché un incidente va ricostruibile anche mesi dopo:
--  1. 30 giorni dopo la fine dell'anno scolastico (fine anno = 30 giugno, quindi dal 31 luglio),
--     per chi non ha rinnovato: contatti di emergenza, backup del genitore, richieste di
--     iscrizione mai approvate. Servono solo a far funzionare il servizio.
--  2. Dopo 12 mesi: presenze, appelli, turni, registro delle consultazioni (dal giorno a cui si
--     riferiscono); il bambino (nome, cognome, classe, iscrizione con linea e fermata) 12 mesi
--     dopo la fine dell'ultimo anno frequentato; il profilo di chi non ha più bambini, turni né
--     ruoli di amministratore, 12 mesi dopo la sua creazione e l'ultima attività.
--  Avvisi: 6 mesi.
-- Gira ogni notte alle 3:00 (ora di Roma) dal dispatcher dei job. I tempi stanno in un posto
-- solo (pulizia_tempi), così se il comitato o l'assicurazione chiedono altro si cambia un numero.
-- =============================================================================

create or replace function pulizia_tempi() returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'fine_anno',          '06-30',   -- mese-giorno di fine anno scolastico
    'giorni_dopo_fine',   30,        -- contatti e backup: giorni dopo la fine dell'anno
    'mesi_storico',       12,        -- presenze, appelli, turni, bambini, profili
    'mesi_avvisi',        6
  )
$$;

-- '2026/27' → 2027-06-30
create or replace function fine_anno_scolastico(p_anno text) returns date
language sql immutable as $$
  select make_date(split_part(p_anno, '/', 1)::int + 1,
                   split_part(pulizia_tempi()->>'fine_anno', '-', 1)::int,
                   split_part(pulizia_tempi()->>'fine_anno', '-', 2)::int)
$$;

create or replace function pulizia_dati(p_at timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  oggi        date := locale(p_at)::date;
  dopo_fine   int  := (pulizia_tempi()->>'giorni_dopo_fine')::int;
  storico     date := oggi - make_interval(months => (pulizia_tempi()->>'mesi_storico')::int);
  t_storico   timestamptz := p_at - make_interval(months => (pulizia_tempi()->>'mesi_storico')::int);
  t_avvisi    timestamptz := p_at - make_interval(months => (pulizia_tempi()->>'mesi_avvisi')::int);
  n           int;
  esito       jsonb := '{}';
  p           record;
  tolti       int := 0;
  saltati     int := 0;
begin
  -- Bambini "in corso": hanno un'iscrizione (anche in attesa) il cui anno non è chiuso da più di 30 giorni.
  drop table if exists bambini_in_corso;
  create temporary table bambini_in_corso on commit drop as
    select distinct bambino_id from iscrizioni
    where fine_anno_scolastico(anno_scolastico) + dopo_fine >= oggi;

  -- 1. Fine anno + 30 giorni ---------------------------------------------------------------------
  delete from contatti_emergenza c where c.bambino_id not in (select bambino_id from bambini_in_corso);
  get diagnostics n = row_count; esito := esito || jsonb_build_object('contatti_emergenza', n);

  delete from deleghe d where not exists (
    select 1 from bambini b join bambini_in_corso x on x.bambino_id = b.id where b.genitore_id = d.genitore_id);
  get diagnostics n = row_count; esito := esito || jsonb_build_object('deleghe', n);

  delete from iscrizioni i where i.stato <> 'approvata' and fine_anno_scolastico(i.anno_scolastico) + dopo_fine < oggi;
  get diagnostics n = row_count; esito := esito || jsonb_build_object('iscrizioni_non_approvate', n);

  -- 2. Storico oltre i 12 mesi ----------------------------------------------------------------------
  delete from avvisi where creato_il < t_avvisi;
  get diagnostics n = row_count; esito := esito || jsonb_build_object('avvisi', n);

  delete from accessi_contatti a
  where a.consultato_il < t_storico or a.turno_id in (select id from turni where giorno < storico);
  get diagnostics n = row_count; esito := esito || jsonb_build_object('consultazioni_contatti', n);

  update avvisi set turno_id = null where turno_id in (select id from turni where giorno < storico);
  delete from turni where giorno < storico;   -- con appelli, appello dei bambini e volontari di turno
  get diagnostics n = row_count; esito := esito || jsonb_build_object('turni', n);

  delete from bozze_turni bz where bz.mese < storico and not exists (select 1 from turni t where t.bozza_id = bz.id);
  get diagnostics n = row_count; esito := esito || jsonb_build_object('bozze_turni', n);

  delete from presenze where giorno < storico;
  get diagnostics n = row_count; esito := esito || jsonb_build_object('presenze', n);

  delete from eccezioni_disponibilita where giorno < storico;
  delete from dotazioni where restituita_il < storico;
  delete from job_eseguiti where giorno < storico;

  -- Bambini: 12 mesi dopo la fine dell'ultimo anno, e solo se non resta nulla che li riguardi.
  delete from bambini b
  where b.id not in (select bambino_id from bambini_in_corso)
    and coalesce((select max(fine_anno_scolastico(i.anno_scolastico)) from iscrizioni i where i.bambino_id = b.id),
                 locale(b.creato_il)::date) < storico
    and not exists (select 1 from presenze pr where pr.bambino_id = b.id)
    and not exists (select 1 from appello_bambini ab where ab.bambino_id = b.id)
    and not exists (select 1 from accessi_contatti ac where ac.bambino_id = b.id);
  get diagnostics n = row_count; esito := esito || jsonb_build_object('bambini', n);

  -- Profili: niente bambini, niente turni rimasti, non admin, non backup di qualcuno, creati da oltre 12 mesi.
  -- Si cancella l'utente di Auth (porta via profilo, ruoli, notifiche, passkey). Se un registro ancora
  -- conservato lo cita in modo obbligatorio (chi ha segnato una presenza, chi ha aperto un appello),
  -- si salta e si riprova la notte dopo: quando il registro scade, il profilo se ne va.
  for p in
    select pe.id from persone pe
    where pe.creato_il < t_storico
      and not exists (select 1 from bambini b where b.genitore_id = pe.id)
      and not exists (select 1 from turni_volontari tv where tv.volontario_id = pe.id)
      and not exists (select 1 from deleghe d where d.delegato_id = pe.id)
      and not exists (select 1 from ruoli r where r.persona_id = pe.id and r.ruolo = 'admin' and r.stato = 'approvata')
  loop
    begin
      -- "Chi ha deciso / chi ha segnato" su registri che restano: la persona non c'è più, il dato sì.
      update ruoli          set deciso_da     = null where deciso_da     = p.id;
      update iscrizioni     set decisa_da     = null where decisa_da     = p.id;
      update bozze_turni    set generata_da   = null where generata_da   = p.id;
      update appelli        set consegnato_da = null where consegnato_da = p.id;
      update appello_bambini set segnato_da   = null where segnato_da    = p.id;
      begin
        delete from auth.users where id = p.id;
      exception when insufficient_privilege then
        null;   -- se Supabase non lascia toccare auth.users, si cancella almeno il profilo
      end;
      delete from persone where id = p.id;   -- di solito già andato in cascata con l'utente
      tolti := tolti + 1;
    exception when foreign_key_violation then
      saltati := saltati + 1;
    end;
  end loop;
  esito := esito || jsonb_build_object('profili', tolti, 'profili_rimandati', saltati);

  return esito;
end $$;
revoke execute on function pulizia_dati(timestamptz) from public, anon, authenticated;

-- Nel dispatcher: ogni notte alle 3:00.
insert into job_orari (nome, ora, note) values
  ('pulizia_dati', '03:00', 'Cancella i dati scaduti secondo i tempi dell''informativa privacy')
on conflict (nome) do nothing;

create or replace function esegui_job(p_at timestamptz default now()) returns text
language plpgsql security definer set search_path = public as $$
declare j record; oggi date := locale(p_at)::date; fatti text := ''; n int; ris text;
begin
  -- Finestra di 30 minuti: se il database era giù, il job non viene recuperato ore dopo (un controllo
  -- volontari delle 6:30 lanciato alle 17:00 annullerebbe linee già partite).
  for j in select * from job_orari where ora <= locale(p_at)::time and locale(p_at)::time < ora + interval '30 minutes' order by ora loop
    if exists (select 1 from job_eseguiti e where e.nome = j.nome and e.giorno = oggi) then continue; end if;
    begin
      ris := 'ok';
      case j.nome
        when 'chiudi_assenze'      then perform chiudi_assenze(null, p_at);
        when 'soglia_definitiva'   then perform soglia_definitiva(null, p_at);
        when 'controllo_volontari' then perform controllo_volontari(null, p_at);
        when 'pulizia_dati'        then ris := 'ok ' || pulizia_dati(p_at)::text;
        else raise notice 'job sconosciuto: %', j.nome;
      end case;
      insert into job_eseguiti (nome, giorno, eseguito_il, esito) values (j.nome, oggi, p_at, ris);
      fatti := fatti || j.nome || ' ';
    exception when others then
      insert into job_eseguiti (nome, giorno, eseguito_il, esito) values (j.nome, oggi, p_at, 'errore: ' || sqlerrm);
      fatti := fatti || j.nome || '(errore) ';
    end;
  end loop;
  -- L'escalation non ha un orario: ogni giro controlla se qualche turno aspetta da più di 10 minuti.
  n := allarga_escalation(p_at);
  if n > 0 then fatti := fatti || format('escalation×%s ', n); end if;
  return nullif(trim(fatti), '');
end $$;
revoke execute on function esegui_job(timestamptz) from public, anon, authenticated;
