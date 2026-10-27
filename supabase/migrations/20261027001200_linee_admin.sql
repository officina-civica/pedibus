-- Linee e fermate si gestiscono dall'app (amministratore): creazione e modifica della linea,
-- sospensione e riattivazione, fermate con ordine, orario e arrivo; giorni senza pedibus.
-- Le regole stanno qui, l'app mostra e chiama.

-- ---------------------------------------------------------------------------
-- salva_linea(): crea (p_id null) o aggiorna una linea. Solo l'admin della scuola.
-- ---------------------------------------------------------------------------
create or replace function salva_linea(
  p_scuola uuid, p_nome text, p_colore text, p_ora_partenza time, p_ora_arrivo time,
  p_soglia_bambini int, p_min_volontari int, p_volontari_consigliati int,
  p_ora_chiusura_assenze time, p_ora_soglia_definitiva time,
  p_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin(p_scuola) then
    raise exception 'Solo l''amministratore modifica le linee' using errcode = '42501';
  end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Serve il nome della linea' using errcode = 'P0001'; end if;
  if p_ora_arrivo <= p_ora_partenza then raise exception 'L''arrivo deve essere dopo la partenza' using errcode = 'P0001'; end if;
  if p_ora_soglia_definitiva < p_ora_chiusura_assenze then
    raise exception 'La soglia definitiva viene dopo la chiusura delle assenze' using errcode = 'P0001';
  end if;
  if p_volontari_consigliati < p_min_volontari then
    raise exception 'I volontari consigliati non possono essere meno del minimo' using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into linee (scuola_id, nome, colore, ora_partenza, ora_arrivo, soglia_bambini, min_volontari, volontari_consigliati, ora_chiusura_assenze, ora_soglia_definitiva)
    values (p_scuola, trim(p_nome), p_colore, p_ora_partenza, p_ora_arrivo, p_soglia_bambini, p_min_volontari, p_volontari_consigliati, p_ora_chiusura_assenze, p_ora_soglia_definitiva)
    returning id into v_id;
    -- Una linea nasce con il capolinea e l'arrivo: le fermate in mezzo si aggiungono dopo.
    insert into fermate (linea_id, ordine, nome, orario, capolinea, arrivo) values
      (v_id, 1, 'Capolinea', p_ora_partenza, true, false),
      (v_id, 2, (select nome from scuole where id = p_scuola), p_ora_arrivo, false, true);
  else
    if not exists (select 1 from linee where id = p_id and scuola_id = p_scuola) then
      raise exception 'Linea non trovata' using errcode = 'P0002';
    end if;
    update linee set nome = trim(p_nome), colore = p_colore, ora_partenza = p_ora_partenza, ora_arrivo = p_ora_arrivo,
      soglia_bambini = p_soglia_bambini, min_volontari = p_min_volontari, volontari_consigliati = p_volontari_consigliati,
      ora_chiusura_assenze = p_ora_chiusura_assenze, ora_soglia_definitiva = p_ora_soglia_definitiva
    where id = p_id;
    -- Capolinea e arrivo seguono gli orari della linea.
    update fermate set orario = p_ora_partenza where linea_id = p_id and capolinea;
    update fermate set orario = p_ora_arrivo where linea_id = p_id and arrivo;
    v_id := p_id;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- sospendi_linea(): mette in stand-by (o riattiva) una linea.
-- Sospesa: niente turni nuovi nelle bozze, niente controlli di soglia; i turni già
-- programmati da oggi in poi vengono annullati e famiglie e volontari avvisati.
-- Le iscrizioni restano: alla riattivazione i bambini ci sono ancora.
-- ---------------------------------------------------------------------------
create or replace function sospendi_linea(p_linea uuid, p_attiva boolean, p_motivo text default null, p_at timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare l linee; t turni; n int := 0; oggi date := locale(p_at)::date;
begin
  select * into l from linee where id = p_linea;
  if l.id is null then raise exception 'Linea non trovata' using errcode = 'P0002'; end if;
  if not is_admin(l.scuola_id) then
    raise exception 'Solo l''amministratore sospende o riattiva le linee' using errcode = '42501';
  end if;
  if l.attiva = p_attiva then return 0; end if;
  update linee set attiva = p_attiva where id = p_linea;

  if not p_attiva then
    for t in select * from turni where linea_id = p_linea and giorno >= oggi and stato in ('programmato', 'riattivato', 'annullato_soglia') loop
      update turni set stato = 'annullato_definitivo', motivo = coalesce(p_motivo, 'Linea sospesa'), aggiornato_il = p_at where id = t.id;
      perform avvisa_volontari_turno(t.id, 'warn', format('%s sospesa: turno del %s annullato', l.nome, to_char(t.giorno, 'DD/MM')),
        coalesce(p_motivo, 'La linea è sospesa dal comitato.'), false, null, p_at);
      n := n + 1;
    end loop;
    perform avvisa_genitori_linea(p_linea, 'warn', format('%s sospesa', l.nome),
      coalesce(p_motivo, 'La linea è sospesa dal comitato fino a nuovo avviso.') || ' Le iscrizioni restano valide: vi avvisiamo quando riparte.', false, null, p_at);
    perform avvisa_admin(l.scuola_id, 'info', format('%s sospesa', l.nome),
      format('%s turni annullati. %s', n, coalesce(p_motivo, '')), false, p_linea, null, p_at);
  else
    perform avvisa_genitori_linea(p_linea, 'ok', format('%s riparte', l.nome),
      coalesce(p_motivo, 'La linea è di nuovo attiva.') || ' I turni tornano con la prossima bozza del mese.', false, null, p_at);
    perform avvisa_admin(l.scuola_id, 'ok', format('%s riattivata', l.nome),
      'Ricorda di generare o rigenerare la bozza dei turni per questa linea.', false, p_linea, null, p_at);
  end if;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Fermate: salva (crea o aggiorna), elimina, riordina. Capolinea = la prima, arrivo = l'ultima.
-- ---------------------------------------------------------------------------
create or replace function normalizza_fermate(p_linea uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f record; i int := 0;
begin
  -- Rinumera 1..n nell'ordine attuale, tenendo l'arrivo per ultimo; capolinea = prima.
  for f in select id from fermate where linea_id = p_linea order by arrivo, ordine loop
    i := i + 1;
    update fermate set ordine = -i where id = f.id;   -- passaggio intermedio in negativo: niente conflitti sull'unique
  end loop;
  for f in select id, -ordine as pos from fermate where linea_id = p_linea order by ordine desc loop
    update fermate set ordine = f.pos, capolinea = (f.pos = 1) where id = f.id;
  end loop;
end $$;

create or replace function salva_fermata(p_linea uuid, p_nome text, p_orario time, p_id uuid default null, p_dopo uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare l linee; v_id uuid; pos int;
begin
  select * into l from linee where id = p_linea;
  if l.id is null then raise exception 'Linea non trovata' using errcode = 'P0002'; end if;
  if not is_admin(l.scuola_id) then
    raise exception 'Solo l''amministratore modifica le fermate' using errcode = '42501';
  end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Serve il nome della fermata' using errcode = 'P0001'; end if;
  if p_id is null then
    -- Nuova fermata: dopo p_dopo (o dopo il capolinea), comunque prima dell'arrivo.
    select ordine into pos from fermate where id = p_dopo and linea_id = p_linea;
    if pos is null then pos := 1; end if;
    update fermate set ordine = ordine + 1000 where linea_id = p_linea and ordine > pos;
    insert into fermate (linea_id, ordine, nome, orario) values (p_linea, pos + 1, trim(p_nome), p_orario) returning id into v_id;
  else
    if not exists (select 1 from fermate where id = p_id and linea_id = p_linea) then
      raise exception 'Fermata non trovata' using errcode = 'P0002';
    end if;
    update fermate set nome = trim(p_nome), orario = p_orario where id = p_id;
    v_id := p_id;
  end if;
  perform normalizza_fermate(p_linea);
  return v_id;
end $$;

create or replace function elimina_fermata(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f fermate;
begin
  select * into f from fermate where id = p_id;
  if f.id is null then raise exception 'Fermata non trovata' using errcode = 'P0002'; end if;
  if not is_admin((select scuola_id from linee where id = f.linea_id)) then
    raise exception 'Solo l''amministratore modifica le fermate' using errcode = '42501';
  end if;
  if f.capolinea or f.arrivo then
    raise exception 'Capolinea e arrivo non si eliminano: si rinominano' using errcode = 'P0001';
  end if;
  if exists (select 1 from iscrizioni i where i.fermata_id = p_id and i.stato in ('approvata', 'in_attesa')) then
    raise exception 'Ci sono bambini iscritti a questa fermata: spostali prima' using errcode = 'P0001';
  end if;
  delete from fermate where id = p_id;
  perform normalizza_fermate(f.linea_id);
end $$;

create or replace function sposta_fermata(p_id uuid, p_su boolean) returns void
language plpgsql security definer set search_path = public as $$
declare f fermate; altra fermate;
begin
  select * into f from fermate where id = p_id;
  if f.id is null then raise exception 'Fermata non trovata' using errcode = 'P0002'; end if;
  if not is_admin((select scuola_id from linee where id = f.linea_id)) then
    raise exception 'Solo l''amministratore modifica le fermate' using errcode = '42501';
  end if;
  if f.capolinea or f.arrivo then
    raise exception 'Capolinea e arrivo restano ai capi della linea' using errcode = 'P0001';
  end if;
  select * into altra from fermate where linea_id = f.linea_id and ordine = (case when p_su then f.ordine - 1 else f.ordine + 1 end);
  if altra.id is null or altra.capolinea or altra.arrivo then return; end if;
  update fermate set ordine = ordine + 1000 where id in (f.id, altra.id);
  update fermate set ordine = altra.ordine where id = f.id;
  update fermate set ordine = f.ordine where id = altra.id;
  perform normalizza_fermate(f.linea_id);
end $$;

-- ---------------------------------------------------------------------------
-- Giorni senza pedibus: aggiungi e togli.
-- ---------------------------------------------------------------------------
create or replace function salva_chiusura(p_scuola uuid, p_giorno date, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(p_scuola) then raise exception 'Solo l''amministratore modifica il calendario' using errcode = '42501'; end if;
  insert into calendario_chiusure (scuola_id, giorno, motivo) values (p_scuola, p_giorno, coalesce(nullif(trim(p_motivo), ''), 'Chiusura'))
  on conflict (scuola_id, giorno) do update set motivo = excluded.motivo;
end $$;

create or replace function elimina_chiusura(p_scuola uuid, p_giorno date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(p_scuola) then raise exception 'Solo l''amministratore modifica il calendario' using errcode = '42501'; end if;
  delete from calendario_chiusure where scuola_id = p_scuola and giorno = p_giorno;
end $$;

revoke execute on function normalizza_fermate(uuid) from anon, authenticated;
revoke execute on function salva_linea(uuid, text, text, time, time, int, int, int, time, time, uuid) from anon;
revoke execute on function sospendi_linea(uuid, boolean, text, timestamptz) from anon;
revoke execute on function salva_fermata(uuid, text, time, uuid, uuid) from anon;
revoke execute on function elimina_fermata(uuid) from anon;
revoke execute on function sposta_fermata(uuid, boolean) from anon;
revoke execute on function salva_chiusura(uuid, date, text) from anon;
revoke execute on function elimina_chiusura(uuid, date) from anon;
