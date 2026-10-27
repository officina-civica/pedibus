-- =============================================================================
-- Pedibus · consegna degli avvisi: push della PWA + SMS di riserva
-- Decisione del 27/10: push come canale principale; SMS sempre per gli urgenti
-- (avvisi.sms = true) e come ripiego per chi non ha attivato le push.
-- Il database mette in coda (tabella avvisi); la Edge Function invia-avvisi
-- svuota la coda. Qui: gli abbonamenti push, gli esiti, e come la funzione
-- viene chiamata (webhook via pg_net all'inserimento + ritentativo via pg_cron).
-- =============================================================================

-- Abbonamenti Web Push: uno per browser/dispositivo. Ognuno gestisce i propri.
create table push_abbonamenti (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references persone(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  creato_il   timestamptz not null default now(),
  ultimo_uso  timestamptz,
  fallito_il  timestamptz                      -- 404/410 dal servizio push: l'abbonamento è morto
);
create index push_abbonamenti_persona_idx on push_abbonamenti(persona_id);
alter table push_abbonamenti enable row level security;
create policy push_miei on push_abbonamenti for all to authenticated
  using (persona_id = auth.uid()) with check (persona_id = auth.uid());

-- Esito della consegna, scritto dalla Edge Function.
alter table avvisi
  add column push_esito text,                  -- 'inviato' | 'nessun_abbonamento' | 'errore: …'
  add column sms_esito  text,                  -- 'inviato' | 'non_richiesto' | 'nessun_telefono' | 'errore: …'
  add column tentativi  int not null default 0,
  add column prossimo_tentativo timestamptz;   -- backoff dopo un errore
create index avvisi_pendenti_idx on avvisi(creato_il)
  where push_esito is null or (sms is true and sms_esito is null);

-- Impostazioni del servizio: niente policy, quindi nessun utente le legge via API.
-- Le leggono solo le funzioni security definer e il service role.
create table impostazioni (
  chiave text primary key,
  valore text not null,
  note   text
);
alter table impostazioni enable row level security;
revoke all on impostazioni from anon, authenticated;
insert into impostazioni (chiave, valore, note) values
  ('sms_ripiego', 'true', 'Chi non ha attivato le push riceve via SMS anche gli avvisi normali (non solo gli urgenti)'),
  ('invia_avvisi_url', '', 'URL della Edge Function invia-avvisi, es. https://<ref>.supabase.co/functions/v1/invia-avvisi'),
  ('invia_avvisi_secret', '', 'Segreto condiviso con la funzione (PEDIBUS_CRON_SECRET)');

-- Chiede alla Edge Function di svuotare la coda. Senza pg_net (locale) o senza URL
-- configurato non fa nulla, senza errori: la coda resta lì per il prossimo giro.
create or replace function avvisi_webhook() returns boolean
language plpgsql security definer set search_path = public as $$
declare v_url text; v_segreto text;
begin
  select valore into v_url from impostazioni where chiave = 'invia_avvisi_url';
  select valore into v_segreto from impostazioni where chiave = 'invia_avvisi_secret';
  if coalesce(v_url, '') = '' then return false; end if;
  begin
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-pedibus-secret', v_segreto),
      body := jsonb_build_object('origine', 'database', 'at', now()),
      timeout_milliseconds := 5000);
    return true;
  exception when undefined_function or undefined_table or invalid_schema_name then
    return false;   -- pg_net non installato
  end;
end $$;
revoke execute on function avvisi_webhook() from public, anon, authenticated;

-- All'inserimento di avvisi (una chiamata per istruzione, non per riga).
create or replace function avvisi_dopo_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform avvisi_webhook();
  return null;
end $$;
create trigger avvisi_webhook_trg after insert on avvisi
  for each statement execute function avvisi_dopo_insert();

-- Ritentativo: ogni 2 minuti, se c'è qualcosa in coda da almeno un minuto.
create or replace function avvisi_ritenta() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from avvisi
    where (push_esito is null or (sms and sms_esito is null))
      and creato_il < now() - interval '1 minute'
      and creato_il > now() - interval '1 day'
      and (prossimo_tentativo is null or prossimo_tentativo <= now())
      and tentativi < 10)
  then return avvisi_webhook(); end if;
  return false;
end $$;
revoke execute on function avvisi_ritenta() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'pedibus_avvisi';
    perform cron.schedule('pedibus_avvisi', '*/2 * * * *', $job$ select avvisi_ritenta() $job$);
  end if;
end $$;
