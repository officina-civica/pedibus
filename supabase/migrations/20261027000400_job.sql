-- =============================================================================
-- Pedibus · job a orario
-- pg_cron su Supabase gira in UTC e non conosce l'ora legale: invece di tradurre
-- gli orari, un dispatcher gira ogni 5 minuti, legge l'ora di Roma e lancia ogni
-- job una volta al giorno, quando è ora. job_eseguiti evita i doppi.
-- In locale pg_cron può mancare: la schedulazione è guardata, le funzioni no.
-- =============================================================================

create table job_eseguiti (
  nome        text not null,
  giorno      date not null,
  eseguito_il timestamptz not null default now(),
  esito       text,
  primary key (nome, giorno)
);
alter table job_eseguiti enable row level security;
create policy job_eseguiti_admin on job_eseguiti for select to authenticated using (is_admin());

-- Orari dei job (ora di Roma). Modificabili dall'admin senza toccare il codice.
create table job_orari (
  nome text primary key,
  ora  time not null,
  note text
);
alter table job_orari enable row level security;
create policy job_orari_admin on job_orari for all to authenticated using (is_admin()) with check (is_admin());
insert into job_orari (nome, ora, note) values
  ('chiudi_assenze',      '18:00', 'Chiude le assenze del prossimo giorno di scuola e applica le soglie'),
  ('soglia_definitiva',   '21:00', 'Le linee annullate restano annullate'),
  ('controllo_volontari', '06:30', 'Un''ora prima: sotto il minimo si annulla e si avvisano le famiglie');

create or replace function esegui_job(p_at timestamptz default now()) returns text
language plpgsql security definer set search_path = public as $$
declare j record; oggi date := locale(p_at)::date; fatti text := ''; n int;
begin
  -- Finestra di 30 minuti: se il database era giù, il job non viene recuperato ore dopo (un controllo
  -- volontari delle 6:30 lanciato alle 17:00 annullerebbe linee già partite).
  for j in select * from job_orari where ora <= locale(p_at)::time and locale(p_at)::time < ora + interval '30 minutes' order by ora loop
    if exists (select 1 from job_eseguiti e where e.nome = j.nome and e.giorno = oggi) then continue; end if;
    begin
      case j.nome
        when 'chiudi_assenze'      then perform chiudi_assenze(null, p_at);
        when 'soglia_definitiva'   then perform soglia_definitiva(null, p_at);
        when 'controllo_volontari' then perform controllo_volontari(null, p_at);
        else raise notice 'job sconosciuto: %', j.nome;
      end case;
      insert into job_eseguiti (nome, giorno, eseguito_il, esito) values (j.nome, oggi, p_at, 'ok');
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

-- Schedulazione: solo dove pg_cron esiste (Supabase sì, Postgres locale di solito no).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'pedibus_job';
    perform cron.schedule('pedibus_job', '*/5 * * * *', $job$ select esegui_job() $job$);
  else
    raise notice 'pg_cron non disponibile: job non schedulati (ok in locale)';
  end if;
end $$;
