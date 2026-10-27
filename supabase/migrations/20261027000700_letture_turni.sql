-- =============================================================================
-- Pedibus · letture per volontario e amministratore
-- Ogni funzione controlla il ruolo da sola e restituisce esattamente ciò che la
-- schermata mostra: così l'app non ricompone regole, e la RLS resta semplice.
-- =============================================================================

create or replace function volontario_o_admin_di(p_scuola uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_volontario(p_scuola) or is_admin(p_scuola)
$$;

-- Il turno visto da chi lo fa: linea, team, copertura, kit, escalation, appello.
create or replace function turno_dettaglio(p_turno uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t turni; l linee; a appelli; out jsonb;
begin
  select * into t from turni where id = p_turno;
  if t.id is null then return null; end if;
  select * into l from linee where id = t.linea_id;
  if not volontario_o_admin_di(l.scuola_id) then
    raise exception 'Turno non visibile' using errcode = '42501';
  end if;
  select * into a from appelli where turno_id = p_turno;
  out := jsonb_build_object(
    'id', t.id, 'giorno', t.giorno, 'stato', t.stato, 'motivo', t.motivo,
    'linea', jsonb_build_object('id', l.id, 'nome', l.nome, 'colore', l.colore, 'ora_partenza', l.ora_partenza,
                                'min_volontari', l.min_volontari, 'soglia_bambini', l.soglia_bambini),
    'capolinea', (select f.nome from fermate f where f.linea_id = l.id order by f.ordine limit 1),
    'attesi', presenti_attesi(l.id, t.giorno),
    'copertura', copertura(t.id), 'kit_presente', kit_presente(t.id),
    'escalation_dal', t.escalation_dal, 'escalation_allargata_il', t.escalation_allargata_il,
    'appello', case when a.id is null then null else jsonb_build_object('id', a.id, 'aperto_il', a.aperto_il, 'consegnato_il', a.consegnato_il) end,
    'volontari', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nome', p.nome || ' ' || p.cognome, 'ruolo', tv.ruolo, 'stato', tv.stato,
        'kit', exists (select 1 from dotazioni d where d.volontario_id = p.id and d.tipo = 'kit' and d.restituita_il is null),
        'sono_io', p.id = auth.uid())
        order by tv.ruolo, p.nome)
      from turni_volontari tv join persone p on p.id = tv.volontario_id where tv.turno_id = t.id), '[]'::jsonb),
    'backup_disponibili', coalesce((
      -- chi potrebbe coprire: volontari approvati della scuola disponibili quel giorno e non già sul turno
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome || ' ' || p.cognome,
        'kit', exists (select 1 from dotazioni d where d.volontario_id = p.id and d.tipo = 'kit' and d.restituita_il is null)) order by p.nome)
      from ruoli r join persone p on p.id = r.persona_id
      where r.scuola_id = l.scuola_id and r.ruolo = 'volontario' and r.stato = 'approvata'
        and disponibile_il(p.id, t.giorno)
        and not exists (select 1 from turni_volontari tv where tv.turno_id = t.id and tv.volontario_id = p.id)), '[]'::jsonb)
  );
  return out;
end $$;
revoke execute on function turno_dettaglio(uuid) from anon;

-- I miei turni in un intervallo (titolare o backup), con lo stato.
create or replace function miei_turni(p_da date, p_a date)
returns table (turno_id uuid, giorno date, linea_id uuid, linea_nome text, colore text, ora_partenza time,
               ruolo ruolo_turno, stato_mio stato_volontario_turno, stato_turno stato_turno, copertura int, min_volontari int)
language sql stable security definer set search_path = public as $$
  select t.id, t.giorno, l.id, l.nome, l.colore, l.ora_partenza, tv.ruolo, tv.stato, t.stato, copertura(t.id), l.min_volontari
  from turni_volontari tv join turni t on t.id = tv.turno_id join linee l on l.id = t.linea_id
  where tv.volontario_id = auth.uid() and t.giorno between p_da and p_a
  order by t.giorno, l.ora_partenza
$$;
revoke execute on function miei_turni(date, date) from anon;

-- Il prossimo turno in cui sono coinvolto (oggi compreso, anche se già consegnato).
create or replace function mio_prossimo_turno() returns uuid
language sql stable security definer set search_path = public as $$
  select t.id from turni_volontari tv join turni t on t.id = tv.turno_id
  where tv.volontario_id = auth.uid() and t.giorno >= oggi_rome()
  order by t.giorno, (select ora_partenza from linee where id = t.linea_id) limit 1
$$;
revoke execute on function mio_prossimo_turno() from anon;

-- Il turno di oggi su cui sono di turno (per l'appello), se c'è.
create or replace function mio_turno_oggi() returns uuid
language sql stable security definer set search_path = public as $$
  select t.id from turni t where t.giorno = oggi_rome() and di_turno(t.id)
  order by (select ora_partenza from linee where id = t.linea_id) limit 1
$$;
revoke execute on function mio_turno_oggi() from anon;

-- Prima della partenza: fermate con quanti bambini sono attesi a ciascuna.
create or replace function appello_anteprima(p_turno uuid)
returns table (fermata_id uuid, ordine int, nome text, orario time, capolinea boolean, arrivo boolean, attesi int)
language plpgsql stable security definer set search_path = public as $$
declare t turni; l linee;
begin
  select * into t from turni where id = p_turno;
  select * into l from linee where id = t.linea_id;
  if not volontario_o_admin_di(l.scuola_id) then raise exception 'Turno non visibile' using errcode = '42501'; end if;
  return query
    select f.id, f.ordine, f.nome, f.orario, f.capolinea, f.arrivo,
           (select count(*)::int from bambini_attesi(l.id, t.giorno) ba where ba.fermata_id = f.id)
    from fermate f where f.linea_id = l.id order by f.ordine;
end $$;
revoke execute on function appello_anteprima(uuid) from anon;

-- Durante l'appello: fermata corrente, bambini con stato, chi si può aggiungere.
create or replace function appello_stato(p_turno uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t turni; a appelli;
begin
  select * into t from turni where id = p_turno;
  if not di_turno(p_turno) and not is_admin(scuola_di_linea(t.linea_id)) then
    raise exception 'Appello non tuo' using errcode = '42501';
  end if;
  select * into a from appelli where turno_id = p_turno;
  if a.id is null then return null; end if;
  return jsonb_build_object(
    'id', a.id, 'aperto_il', a.aperto_il, 'consegnato_il', a.consegnato_il,
    'fermata_corrente', (select jsonb_build_object('id', f.id, 'ordine', f.ordine, 'nome', f.nome, 'orario', f.orario, 'arrivo', f.arrivo)
                         from fermate f where f.id = a.fermata_corrente),
    'fermate', (select count(*) from fermate f where f.linea_id = t.linea_id and not f.arrivo),
    'bambini', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'nome', b.nome || ' ' || b.cognome, 'classe', b.classe, 'stato', ab.stato,
        'fermata_id', ab.fermata_id, 'fermata_ordine', f.ordine,
        'tardiva', exists (select 1 from presenze p where p.bambino_id = b.id and p.giorno = t.giorno and p.tardiva))
        order by f.ordine, b.nome)
      from appello_bambini ab join bambini b on b.id = ab.bambino_id left join fermate f on f.id = ab.fermata_id
      where ab.appello_id = a.id), '[]'::jsonb),
    'aggiungibili', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome || ' ' || b.cognome, 'classe', b.classe) order by b.nome)
      from iscrizioni i join bambini b on b.id = i.bambino_id
      where i.linea_id = t.linea_id and i.stato = 'approvata'
        and not exists (select 1 from appello_bambini ab where ab.appello_id = a.id and ab.bambino_id = b.id)), '[]'::jsonb),
    'volontari', nomi_volontari(t.id), 'kit_presente', kit_presente(t.id)
  );
end $$;
revoke execute on function appello_stato(uuid) from anon;

-- Il quadro dell'amministratore per un giorno: ogni linea con stato, presenti, copertura, kit, escalation.
create or replace function riepilogo_admin(p_giorno date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s uuid; g date;
begin
  select r.scuola_id into s from ruoli r where r.persona_id = auth.uid() and r.ruolo = 'admin' and r.stato = 'approvata' limit 1;
  if s is null then raise exception 'Solo l''amministratore' using errcode = '42501'; end if;
  g := coalesce(p_giorno, giorno_riferimento(s));
  return jsonb_build_object(
    'giorno', g,
    'iscrizioni_in_attesa', (select count(*) from iscrizioni i join bambini b on b.id = i.bambino_id where b.scuola_id = s and i.stato = 'in_attesa'),
    'ruoli_in_attesa', (select count(*) from ruoli r where r.scuola_id = s and r.stato = 'in_attesa'),
    'bozza', (select jsonb_build_object('id', bz.id, 'mese', bz.mese, 'stato', bz.stato, 'stale', bz.stale, 'inviata_il', bz.inviata_il, 'scadenza', bz.scadenza_silenzio_assenso)
              from bozze_turni bz where bz.scuola_id = s order by bz.mese desc limit 1),
    'linee', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'nome', l.nome, 'colore', l.colore, 'ora_partenza', l.ora_partenza, 'soglia_bambini', l.soglia_bambini, 'min_volontari', l.min_volontari,
        'turno_id', t.id, 'stato', coalesce(t.stato, 'programmato'), 'motivo', t.motivo,
        'presenti', presenti_attesi(l.id, g), 'iscritti', (select count(*) from iscrizioni i where i.linea_id = l.id and i.stato = 'approvata'),
        'copertura', case when t.id is null then 0 else copertura(t.id) end,
        'kit_presente', case when t.id is null then false else kit_presente(t.id) end,
        'volontari', case when t.id is null then 'nessuno' else nomi_volontari(t.id) end,
        'escalation_dal', t.escalation_dal, 'escalation_allargata_il', t.escalation_allargata_il,
        'mancanti', coalesce((select string_agg(p.nome || ' ' || p.cognome, ', ') from turni_volontari tv join persone p on p.id = tv.volontario_id where tv.turno_id = t.id and tv.stato = 'non_viene'), ''),
        'consegnato_alle', (select locale(a.consegnato_il)::time from appelli a where a.turno_id = t.id and a.consegnato_il is not null))
        order by l.ora_partenza, l.nome)
      from linee l left join turni t on t.linea_id = l.id and t.giorno = g
      where l.scuola_id = s and l.attiva), '[]'::jsonb)
  );
end $$;
revoke execute on function riepilogo_admin(date) from anon;

-- Turni di un giorno per l'amministratore, con i team.
create or replace function turni_del_giorno(p_giorno date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s uuid;
begin
  select r.scuola_id into s from ruoli r where r.persona_id = auth.uid() and r.ruolo = 'admin' and r.stato = 'approvata' limit 1;
  if s is null then raise exception 'Solo l''amministratore' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(turno_dettaglio(t.id) order by l.ora_partenza)
    from linee l join turni t on t.linea_id = l.id and t.giorno = p_giorno
    where l.scuola_id = s and l.attiva), '[]'::jsonb);
end $$;
revoke execute on function turni_del_giorno(date) from anon;
