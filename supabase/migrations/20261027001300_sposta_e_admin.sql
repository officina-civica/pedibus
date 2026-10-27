-- Due cose che l'amministratore fa dall'app: spostare un bambino di fermata (anche di linea)
-- e nominare o revocare altri amministratori.

-- ---------------------------------------------------------------------------
-- sposta_iscrizione(): cambia linea e fermata di un'iscrizione; il genitore viene avvisato.
-- Vale per le iscrizioni approvate e per quelle in attesa (che restano in attesa).
-- ---------------------------------------------------------------------------
create or replace function sposta_iscrizione(p_iscrizione uuid, p_linea uuid, p_fermata uuid, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare i iscrizioni; b bambini; l linee; f fermate;
begin
  select * into i from iscrizioni where id = p_iscrizione;
  if i.id is null then raise exception 'Iscrizione non trovata' using errcode = 'P0002'; end if;
  select * into b from bambini where id = i.bambino_id;
  if not is_admin(b.scuola_id) then
    raise exception 'Solo l''amministratore sposta i bambini di fermata' using errcode = '42501';
  end if;
  if i.stato = 'rifiutata' then raise exception 'L''iscrizione è stata rifiutata' using errcode = 'P0001'; end if;
  select * into l from linee where id = p_linea and scuola_id = b.scuola_id;
  if l.id is null then raise exception 'Linea non trovata' using errcode = 'P0002'; end if;
  select * into f from fermate where id = p_fermata and linea_id = p_linea and not arrivo;
  if f.id is null then raise exception 'Fermata non valida per la linea' using errcode = 'P0001'; end if;
  if i.linea_id = p_linea and i.fermata_id = p_fermata then return; end if;

  update iscrizioni set linea_id = p_linea, fermata_id = p_fermata where id = p_iscrizione;
  if i.stato = 'approvata' then
    perform avvisa(b.genitore_id, 'info', format('%s cambia fermata', b.nome),
      format('Da domani %s alla fermata %s (%s, ore %s). Se c''è un errore, contatta il comitato.',
        case when b.genere = 'F' then 'la aspettiamo' when b.genere = 'M' then 'lo aspettiamo' else 'è atteso/a' end,
        f.nome, l.nome, to_char(f.orario, 'HH24:MI')), false, l.id, null, p_at);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- revoca_admin(): toglie il ruolo di amministratore. Mai l'ultimo rimasto.
-- ---------------------------------------------------------------------------
create or replace function revoca_admin(p_persona uuid, p_scuola uuid, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(p_scuola) then
    raise exception 'Solo l''amministratore revoca altri amministratori' using errcode = '42501';
  end if;
  if (select count(*) from ruoli where scuola_id = p_scuola and ruolo = 'admin' and stato = 'approvata') <= 1 then
    raise exception 'Deve restare almeno un amministratore' using errcode = 'P0001';
  end if;
  delete from ruoli where persona_id = p_persona and scuola_id = p_scuola and ruolo = 'admin';
  if p_persona <> auth.uid() then
    perform avvisa(p_persona, 'info', 'Non sei più amministratore del pedibus', 'Il ruolo è stato revocato dal comitato. Gli altri tuoi ruoli restano.', false, null, null, p_at);
  end if;
end $$;

-- Persone registrate della scuola, per la nomina: nome, cognome e ruoli. Solo per l'admin.
create or replace function persone_scuola(p_scuola uuid)
returns table (id uuid, nome text, cognome text, telefono text, ruoli text[])
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.cognome, p.telefono,
         coalesce(array_agg(r.ruolo::text order by r.ruolo) filter (where r.stato = 'approvata'), '{}') as ruoli
  from persone p
  left join ruoli r on r.persona_id = p.id and r.scuola_id = p_scuola
  where is_admin(p_scuola) and p.nome <> '' and p.cognome <> ''
  group by p.id, p.nome, p.cognome, p.telefono
  order by p.cognome, p.nome
$$;

revoke execute on function sposta_iscrizione(uuid, uuid, uuid, timestamptz) from anon;
revoke execute on function revoca_admin(uuid, uuid, timestamptz) from anon;
revoke execute on function persone_scuola(uuid) from anon;
