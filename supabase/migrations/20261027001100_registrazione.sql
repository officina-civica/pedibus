-- Registrazione unica dopo il primo accesso, fermata facoltativa all'iscrizione,
-- assegnazione di linea e fermata da parte dell'amministratore in approvazione.
--
-- Chi entra la prima volta dice chi è (nome, cognome, genitore e/o volontario) e accetta
-- l'informativa una volta sola: `registrati()`. Il genitore poi iscrive i bambini; la fermata
-- può restare vuota ("la decidiamo col comitato") e la assegna l'admin quando approva.
-- L'amministratore non si registra mai da solo: il primo si nomina a mano, gli altri li
-- nomina un admin con `nomina_admin()`.

-- ---------------------------------------------------------------------------
-- Persone: consenso all'informativa dato in registrazione
-- ---------------------------------------------------------------------------
alter table persone
  add column if not exists informativa_id uuid references informative(id),
  add column if not exists consenso_il    timestamptz;

comment on column persone.informativa_id is 'Informativa accettata in registrazione (le iscrizioni ne ricordano una propria).';

-- ---------------------------------------------------------------------------
-- registrati(): nome, cognome, ruoli richiesti, consenso. Idempotente.
-- ---------------------------------------------------------------------------
create or replace function registrati(
  p_nome text, p_cognome text, p_scuola uuid, p_ruoli ruolo_tipo[], p_informativa uuid,
  p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare r ruolo_tipo; chi text;
begin
  if auth.uid() is null then raise exception 'Devi essere autenticato' using errcode = '42501'; end if;
  if coalesce(trim(p_nome), '') = '' or coalesce(trim(p_cognome), '') = '' then
    raise exception 'Servono nome e cognome' using errcode = 'P0001';
  end if;
  if p_ruoli is null or cardinality(p_ruoli) = 0 then
    raise exception 'Scegli se sei genitore, volontario o entrambi' using errcode = 'P0001';
  end if;
  if 'admin' = any (p_ruoli) then
    raise exception 'L''amministratore non si registra da solo' using errcode = '42501';
  end if;
  if not exists (select 1 from informative where id = p_informativa) then
    raise exception 'Informativa non valida' using errcode = 'P0001';
  end if;

  update persone set nome = trim(p_nome), cognome = trim(p_cognome), informativa_id = p_informativa, consenso_il = coalesce(consenso_il, p_at)
  where id = auth.uid();

  foreach r in array p_ruoli loop
    -- Il genitore resta in attesa finché la prima iscrizione non viene approvata (decidi_iscrizione);
    -- il volontario finché l'admin non verifica l'albo (decidi_ruolo).
    insert into ruoli (persona_id, scuola_id, ruolo, richiesto_il) values (auth.uid(), p_scuola, r, p_at)
    on conflict (persona_id, scuola_id, ruolo) do nothing;
  end loop;

  if 'volontario' = any (p_ruoli) and exists (
    select 1 from ruoli x where x.persona_id = auth.uid() and x.scuola_id = p_scuola and x.ruolo = 'volontario' and x.stato = 'in_attesa' and x.deciso_il is null) then
    chi := trim(p_nome) || ' ' || trim(p_cognome);
    perform avvisa_admin(p_scuola, 'info', format('Nuovo volontario: %s', chi),
      'Chiede di essere abilitato. Da verificare nell''albo dei volontari civici.', false, null, null, p_at);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- nomina_admin(): solo un admin della scuola può nominarne un altro, tra le persone registrate.
-- ---------------------------------------------------------------------------
create or replace function nomina_admin(p_persona uuid, p_scuola uuid, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(p_scuola) then
    raise exception 'Solo l''amministratore nomina altri amministratori' using errcode = '42501';
  end if;
  if not exists (select 1 from persone p where p.id = p_persona and p.nome <> '' and p.cognome <> '') then
    raise exception 'La persona deve essersi registrata nell''app' using errcode = 'P0001';
  end if;
  insert into ruoli (persona_id, scuola_id, ruolo, stato, deciso_da, deciso_il, richiesto_il)
  values (p_persona, p_scuola, 'admin', 'approvata', auth.uid(), p_at, p_at)
  on conflict (persona_id, scuola_id, ruolo) do update set stato = 'approvata', deciso_da = excluded.deciso_da, deciso_il = excluded.deciso_il;
  perform avvisa(p_persona, 'ok'::tipo_avviso, 'Sei amministratore del pedibus', 'Da ora vedi e decidi iscrizioni, turni e linee.', false, null, null, p_at);
end $$;

-- ---------------------------------------------------------------------------
-- Iscrizioni: linea e fermata facoltative finché l'iscrizione è in attesa
-- ---------------------------------------------------------------------------
alter table iscrizioni
  alter column linea_id drop not null,
  alter column fermata_id drop not null;

alter table iscrizioni
  add constraint iscrizioni_approvata_con_fermata
  check (stato <> 'approvata' or (linea_id is not null and fermata_id is not null));

-- iscrivi_bambino: la fermata può mancare; se c'è, deve essere coerente con la linea.
create or replace function iscrivi_bambino(
  p_scuola uuid, p_nome text, p_cognome text, p_classe text, p_genere char,
  p_linea uuid, p_fermata uuid, p_informativa uuid,
  p_contatti jsonb default '[]', p_at timestamptz default now()) returns uuid
language plpgsql security definer set search_path = public as $$
declare b bambini; c jsonb; chi text; dove text;
begin
  if auth.uid() is null then raise exception 'Devi essere autenticato' using errcode = '42501'; end if;
  if (p_linea is null) <> (p_fermata is null) then
    raise exception 'Linea e fermata vanno indicate insieme, o nessuna delle due' using errcode = 'P0001';
  end if;
  if p_fermata is not null and not exists (select 1 from fermate f where f.id = p_fermata and f.linea_id = p_linea and not f.arrivo) then
    raise exception 'Fermata non valida per la linea' using errcode = 'P0001';
  end if;
  insert into ruoli (persona_id, scuola_id, ruolo) values (auth.uid(), p_scuola, 'genitore') on conflict do nothing;
  insert into bambini (scuola_id, genitore_id, nome, cognome, classe, genere)
  values (p_scuola, auth.uid(), p_nome, p_cognome, p_classe, p_genere) returning * into b;
  insert into iscrizioni (bambino_id, linea_id, fermata_id, anno_scolastico, informativa_id, consenso_il, richiesta_il)
  values (b.id, p_linea, p_fermata, anno_scolastico_di(locale(p_at)::date), p_informativa, p_at, p_at);
  for c in select * from jsonb_array_elements(p_contatti) loop
    insert into contatti_emergenza (bambino_id, nome, relazione, telefono, ordine)
    values (b.id, c ->> 'nome', c ->> 'relazione', c ->> 'telefono', coalesce((c ->> 'ordine')::int, 1));
  end loop;
  select p.nome || ' ' || p.cognome into chi from persone p where p.id = auth.uid();
  dove := case when p_fermata is null then 'fermata da assegnare'
               else format('%s, %s', (select nome from linee where id = p_linea), (select nome from fermate where id = p_fermata)) end;
  perform avvisa_admin(p_scuola, 'info', format('Nuova iscrizione da %s', chi),
    format('%s %s · %s. Da approvare.', p_nome, p_cognome, dove), false, p_linea, null, p_at);
  return b.id;
end $$;

-- decidi_iscrizione: in approvazione l'admin può assegnare (o correggere) linea e fermata;
-- se mancano e non le passa, l'approvazione si ferma.
drop function if exists decidi_iscrizione(uuid, stato_approvazione, text, timestamptz);
create or replace function decidi_iscrizione(
  p_iscrizione uuid, p_stato stato_approvazione, p_motivo text default null, p_at timestamptz default now(),
  p_linea uuid default null, p_fermata uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare i iscrizioni; b bambini; l linee; v_linea uuid; v_fermata uuid;
begin
  select * into i from iscrizioni where id = p_iscrizione;
  select * into b from bambini where id = i.bambino_id;
  if not is_admin(b.scuola_id) then
    raise exception 'Solo l''amministratore decide le iscrizioni' using errcode = '42501';
  end if;
  v_linea := coalesce(p_linea, i.linea_id);
  v_fermata := case when p_linea is not null then p_fermata else coalesce(p_fermata, i.fermata_id) end;
  if p_stato = 'approvata' then
    if v_linea is null or v_fermata is null then
      raise exception 'Per approvare servono linea e fermata' using errcode = 'P0001';
    end if;
    if not exists (select 1 from fermate f where f.id = v_fermata and f.linea_id = v_linea and not f.arrivo) then
      raise exception 'Fermata non valida per la linea' using errcode = 'P0001';
    end if;
  end if;
  update iscrizioni set stato = p_stato, linea_id = v_linea, fermata_id = v_fermata,
    decisa_da = auth.uid(), decisa_il = p_at, motivo_rifiuto = p_motivo where id = p_iscrizione;
  -- Il genitore principale diventa (o resta) genitore approvato della scuola.
  if p_stato = 'approvata' then
    insert into ruoli (persona_id, scuola_id, ruolo, stato, deciso_da, deciso_il)
    values (b.genitore_id, b.scuola_id, 'genitore', 'approvata', auth.uid(), p_at)
    on conflict (persona_id, scuola_id, ruolo) do update set stato = 'approvata', deciso_da = excluded.deciso_da, deciso_il = excluded.deciso_il;
  end if;
  select * into l from linee where id = v_linea;
  perform avvisa(b.genitore_id, (case when p_stato = 'approvata' then 'ok' else 'warn' end)::tipo_avviso,
    format('Iscrizione di %s %s', b.nome, case when p_stato = 'approvata' then 'approvata' else 'rifiutata' end),
    case when p_stato = 'approvata'
      then format('%s, fermata %s. Da domani è atteso alla fermata salvo avviso.', l.nome, (select nome from fermate where id = v_fermata))
      else coalesce(p_motivo, 'Contatta l''amministratore per i dettagli.') end, false, l.id, null, p_at);
end $$;

revoke execute on function registrati(text, text, uuid, ruolo_tipo[], uuid, timestamptz) from anon;
revoke execute on function nomina_admin(uuid, uuid, timestamptz) from anon;
