-- =============================================================================
-- Pedibus · regole
-- Le funzioni che l'app chiama (RPC) e quelle che i job a orario eseguono.
-- Tutte prendono un p_at (default now()) così la stessa logica si può rigiocare
-- nei test a un'ora qualsiasi. Gli orari sono letti in Europe/Rome.
-- Le funzioni RPC sono security definer: scrivono avvisi per altre persone, cosa
-- che la RLS del chiamante non permetterebbe; per questo controllano da sole
-- chi le chiama (auth.uid()).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tempo
-- ---------------------------------------------------------------------------
create or replace function locale(p_at timestamptz) returns timestamp
language sql immutable as $$ select p_at at time zone 'Europe/Rome' $$;

create or replace function in_rome(p_giorno date, p_ora time) returns timestamptz
language sql immutable as $$ select (p_giorno + p_ora) at time zone 'Europe/Rome' $$;

create or replace function anno_scolastico_di(p_giorno date) returns text
language sql immutable as $$
  select case when extract(month from p_giorno) >= 9
    then extract(year from p_giorno)::int || '/' || to_char((extract(year from p_giorno)::int + 1) % 100, 'FM00')
    else (extract(year from p_giorno)::int - 1) || '/' || to_char(extract(year from p_giorno)::int % 100, 'FM00') end
$$;

create or replace function giorno_di_scuola(p_scuola uuid, p_giorno date) returns boolean
language sql stable as $$
  select extract(isodow from p_giorno) between 1 and 5
     and not exists (select 1 from calendario_chiusure c where c.scuola_id = p_scuola and c.giorno = p_giorno)
$$;

-- Il giorno a cui si riferiscono presenze e appello: oggi se siamo prima delle 9:00
-- di un giorno di scuola, altrimenti il prossimo giorno di scuola.
create or replace function giorno_riferimento(p_scuola uuid, p_at timestamptz default now()) returns date
language plpgsql stable as $$
declare
  d date := locale(p_at)::date;
begin
  if locale(p_at)::time < '09:00' and giorno_di_scuola(p_scuola, d) then
    return d;
  end if;
  loop
    d := d + 1;
    exit when giorno_di_scuola(p_scuola, d);
  end loop;
  return d;
end $$;

-- ---------------------------------------------------------------------------
-- Chi è chi (usate anche dalla RLS)
-- ---------------------------------------------------------------------------
create or replace function is_admin(p_scuola uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ruoli r
    where r.persona_id = auth.uid() and r.ruolo = 'admin' and r.stato = 'approvata'
      and (p_scuola is null or r.scuola_id = p_scuola))
$$;

create or replace function is_volontario(p_scuola uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ruoli r
    where r.persona_id = auth.uid() and r.ruolo = 'volontario' and r.stato = 'approvata'
      and (p_scuola is null or r.scuola_id = p_scuola))
$$;

-- I bambini di cui rispondo: miei, o di chi mi ha delegato.
create or replace function miei_bambini() returns setof uuid
language sql stable security definer set search_path = public as $$
  select b.id from bambini b where b.genitore_id = auth.uid()
  union
  select b.id from bambini b join deleghe d on d.genitore_id = b.genitore_id
  where d.delegato_id = auth.uid()
$$;

-- Le linee su cui ho bambini con iscrizione approvata.
create or replace function mie_linee() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct i.linea_id from iscrizioni i
  where i.stato = 'approvata' and i.bambino_id in (select miei_bambini())
$$;

-- Sono assegnato a questo turno (titolare che viene, o backup che copre)?
create or replace function di_turno(p_turno uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from turni_volontari tv
    where tv.turno_id = p_turno and tv.volontario_id = auth.uid()
      and ((tv.ruolo = 'titolare' and tv.stato <> 'non_viene') or tv.stato = 'copre'))
$$;

create or replace function turno_in_corso_mio(p_turno uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select di_turno(p_turno) and exists (select 1 from turni t where t.id = p_turno and t.stato = 'in_corso')
$$;

-- ---------------------------------------------------------------------------
-- Letture di comodo
-- ---------------------------------------------------------------------------
create or replace function iscrizione_corrente(p_bambino uuid) returns iscrizioni
language sql stable as $$
  select i.* from iscrizioni i
  where i.bambino_id = p_bambino and i.stato = 'approvata'
  order by i.decisa_il desc nulls last limit 1
$$;

-- Bambini attesi su una linea in un giorno: iscritti approvati meno chi è segnato assente.
create or replace function bambini_attesi(p_linea uuid, p_giorno date)
returns table (bambino_id uuid, fermata_id uuid)
language sql stable as $$
  select i.bambino_id, i.fermata_id
  from iscrizioni i
  where i.linea_id = p_linea and i.stato = 'approvata'
    and not exists (select 1 from presenze p where p.bambino_id = i.bambino_id and p.giorno = p_giorno and p.stato = 'assente')
$$;

create or replace function presenti_attesi(p_linea uuid, p_giorno date) returns int
language sql stable as $$ select count(*)::int from bambini_attesi(p_linea, p_giorno) $$;

-- Il turno di una linea in un giorno: lo crea se manca (programmato, senza volontari).
create or replace function turno_del(p_linea uuid, p_giorno date) returns turni
language plpgsql as $$
declare t turni;
begin
  select * into t from turni where linea_id = p_linea and giorno = p_giorno;
  if not found then
    insert into turni (linea_id, giorno) values (p_linea, p_giorno) returning * into t;
  end if;
  return t;
end $$;

create or replace function turno_parte(p_stato stato_turno) returns boolean
language sql immutable as $$ select p_stato in ('programmato', 'riattivato', 'in_corso', 'consegnato') $$;

-- Volontari che vengono davvero: titolari non "non_viene" + backup che coprono.
create or replace function copertura(p_turno uuid) returns int
language sql stable as $$
  select count(*)::int from turni_volontari tv
  where tv.turno_id = p_turno
    and ((tv.ruolo = 'titolare' and tv.stato <> 'non_viene') or tv.stato = 'copre')
$$;

create or replace function kit_presente(p_turno uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from turni_volontari tv
    join dotazioni d on d.volontario_id = tv.volontario_id and d.tipo = 'kit' and d.restituita_il is null
    where tv.turno_id = p_turno
      and ((tv.ruolo = 'titolare' and tv.stato <> 'non_viene') or tv.stato = 'copre'))
$$;

create or replace function nomi_volontari(p_turno uuid) returns text
language sql stable as $$
  select coalesce(string_agg(p.nome, ', ' order by tv.ruolo, p.nome), 'nessuno')
  from turni_volontari tv join persone p on p.id = tv.volontario_id
  where tv.turno_id = p_turno
    and ((tv.ruolo = 'titolare' and tv.stato <> 'non_viene') or tv.stato = 'copre')
$$;

create or replace function nome_bambino(p_bambino uuid) returns text
language sql stable as $$ select b.nome || ' ' || b.cognome from bambini b where b.id = p_bambino $$;

create or replace function mese_it(p_giorno date) returns text
language sql immutable as $$
  select (array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'])[extract(month from p_giorno)::int]
$$;

create or replace function ora_hhmm(p_at timestamptz) returns text
language sql immutable as $$ select to_char(locale(p_at), 'FMHH24:MI') $$;

-- ---------------------------------------------------------------------------
-- Avvisi
-- ---------------------------------------------------------------------------
create or replace function avvisa(
  p_destinatario uuid, p_tipo tipo_avviso, p_titolo text, p_corpo text,
  p_sms boolean default false, p_linea uuid default null, p_turno uuid default null,
  p_at timestamptz default now()) returns void
language sql as $$
  insert into avvisi (destinatario_id, tipo, titolo, corpo, sms, linea_id, turno_id, creato_il)
  values (p_destinatario, p_tipo, p_titolo, p_corpo, p_sms, p_linea, p_turno, p_at)
$$;

-- Ai genitori principali dei bambini con iscrizione approvata sulla linea (uno per famiglia).
create or replace function avvisa_genitori_linea(
  p_linea uuid, p_tipo tipo_avviso, p_titolo text, p_corpo text, p_sms boolean,
  p_turno uuid default null, p_at timestamptz default now()) returns void
language sql as $$
  insert into avvisi (destinatario_id, tipo, titolo, corpo, sms, linea_id, turno_id, creato_il)
  select distinct b.genitore_id, p_tipo, p_titolo, p_corpo, p_sms, p_linea, p_turno, p_at
  from iscrizioni i join bambini b on b.id = i.bambino_id
  where i.linea_id = p_linea and i.stato = 'approvata'
$$;

-- Ai volontari assegnati al turno (titolari e backup), escluso chi è p_escluso.
create or replace function avvisa_volontari_turno(
  p_turno uuid, p_tipo tipo_avviso, p_titolo text, p_corpo text, p_sms boolean,
  p_escluso uuid default null, p_at timestamptz default now()) returns void
language sql as $$
  insert into avvisi (destinatario_id, tipo, titolo, corpo, sms, linea_id, turno_id, creato_il)
  select tv.volontario_id, p_tipo, p_titolo, p_corpo, p_sms, t.linea_id, p_turno, p_at
  from turni_volontari tv join turni t on t.id = tv.turno_id
  where tv.turno_id = p_turno and (p_escluso is null or tv.volontario_id <> p_escluso)
$$;

create or replace function avvisa_admin(
  p_scuola uuid, p_tipo tipo_avviso, p_titolo text, p_corpo text, p_sms boolean default false,
  p_linea uuid default null, p_turno uuid default null, p_at timestamptz default now()) returns void
language sql as $$
  insert into avvisi (destinatario_id, tipo, titolo, corpo, sms, linea_id, turno_id, creato_il)
  select r.persona_id, p_tipo, p_titolo, p_corpo, p_sms, p_linea, p_turno, p_at
  from ruoli r where r.scuola_id = p_scuola and r.ruolo = 'admin' and r.stato = 'approvata'
$$;

create or replace function scuola_di_linea(p_linea uuid) returns uuid
language sql stable as $$ select scuola_id from linee where id = p_linea $$;

-- ---------------------------------------------------------------------------
-- Soglia bambini: 18:00 annulla, modifica tardiva può riattivare, 21:00 definitiva
-- ---------------------------------------------------------------------------
create or replace function valuta_soglia(p_linea uuid, p_giorno date, p_at timestamptz default now()) returns stato_turno
language plpgsql as $$
declare
  l linee; t turni; n int;
  chiusura timestamptz; definitiva timestamptz;
begin
  select * into l from linee where id = p_linea;
  t := turno_del(p_linea, p_giorno);
  n := presenti_attesi(p_linea, p_giorno);
  chiusura   := in_rome(p_giorno - 1, l.ora_chiusura_assenze);
  definitiva := in_rome(p_giorno - 1, l.ora_soglia_definitiva);

  if p_at < chiusura or p_at >= definitiva then
    return t.stato;   -- prima delle 18:00 non si decide; dopo le 21:00 decide soglia_definitiva
  end if;

  if n < l.soglia_bambini and t.stato in ('programmato', 'riattivato') then
    update turni set stato = 'annullato_soglia', presenti_attesi = n,
      motivo = format('%s presenti, minimo %s', n, l.soglia_bambini) where id = t.id;
    perform avvisa_genitori_linea(p_linea, 'warn', format('%s annullata per domani', l.nome),
      format('Solo %s bambini presenti, minimo %s. Si riattiva da sola se entro le %s si raggiunge la soglia.',
             n, l.soglia_bambini, to_char(l.ora_soglia_definitiva, 'FMHH24:MI')), true, t.id, p_at);
    perform avvisa_volontari_turno(t.id, 'warn', format('%s annullata per domani', l.nome),
      format('%s bambini presenti su un minimo di %s. Il turno è sospeso, salvo riattivazione entro le %s.',
             n, l.soglia_bambini, to_char(l.ora_soglia_definitiva, 'FMHH24:MI')), true, null, p_at);
    perform avvisa_admin(l.scuola_id, 'warn', format('%s sotto soglia', l.nome),
      format('%s presenti alle %s, minimo %s. Annullata, riattivabile fino alle %s.',
             n, ora_hhmm(p_at), l.soglia_bambini, to_char(l.ora_soglia_definitiva, 'FMHH24:MI')), false, p_linea, t.id, p_at);
    return 'annullato_soglia';
  end if;

  if n >= l.soglia_bambini and t.stato = 'annullato_soglia' then
    update turni set stato = 'riattivato', presenti_attesi = n, motivo = null where id = t.id;
    perform avvisa_genitori_linea(p_linea, 'ok', format('%s riattivata', l.nome),
      format('Raggiunti %s bambini: il pedibus di domani parte alle %s.', n, to_char(l.ora_partenza, 'FMHH24:MI')), true, t.id, p_at);
    perform avvisa_volontari_turno(t.id, 'ok', format('%s riattivata', l.nome),
      format('%s bambini presenti: il turno di domani è confermato.', n), true, null, p_at);
    perform avvisa_admin(l.scuola_id, 'ok', format('%s riattivata', l.nome),
      format('%s presenti alle %s: soglia raggiunta.', n, ora_hhmm(p_at)), false, p_linea, t.id, p_at);
    return 'riattivato';
  end if;

  update turni set presenti_attesi = n where id = t.id;
  return t.stato;
end $$;

-- RPC genitore (o delegato): segna o annulla un'assenza. Ritorna il messaggio da mostrare.
create or replace function segna_presenza(
  p_bambino uuid, p_stato stato_presenza, p_giorno date default null, p_at timestamptz default now()) returns text
language plpgsql security definer set search_path = public as $$
declare
  b bambini; i iscrizioni; l linee; t turni; g date;
  tardiva boolean; prima stato_presenza; dopo stato_turno; chi text;
begin
  if auth.uid() is null or p_bambino not in (select miei_bambini()) then
    raise exception 'Non puoi segnare le presenze di questo bambino' using errcode = '42501';
  end if;
  select * into b from bambini where id = p_bambino;
  i := iscrizione_corrente(p_bambino);
  if i.id is null then
    raise exception 'Il bambino non ha un''iscrizione approvata' using errcode = 'P0001';
  end if;
  select * into l from linee where id = i.linea_id;
  g := coalesce(p_giorno, giorno_riferimento(b.scuola_id, p_at));

  select stato into prima from presenze where bambino_id = p_bambino and giorno = g;
  if coalesce(prima, 'presente') = p_stato then
    return 'Nessuna modifica.';
  end if;

  tardiva := p_at >= in_rome(g - 1, l.ora_chiusura_assenze);
  insert into presenze (bambino_id, giorno, stato, tardiva, segnata_da, segnata_il)
  values (p_bambino, g, p_stato, tardiva, auth.uid(), p_at)
  on conflict (bambino_id, giorno) do update
    set stato = excluded.stato, tardiva = excluded.tardiva, segnata_da = excluded.segnata_da, segnata_il = excluded.segnata_il;

  if not tardiva then
    return case p_stato when 'assente' then 'Assenza segnalata.' else 'Assenza annullata.' end;
  end if;

  -- Modifica tardiva: lo sanno i volontari del turno e l'amministratore.
  t := turno_del(l.id, g);
  select p.nome || ' ' || p.cognome into chi from persone p where p.id = auth.uid();
  perform avvisa_volontari_turno(t.id, 'warn',
    format('%s: %s (modifica tardiva)', nome_bambino(p_bambino),
           case p_stato when 'assente' then 'assente domani' else 'assenza annullata, domani c''è' end),
    format('Segnato da %s alle %s · %s, fermata %s.', chi, ora_hhmm(p_at), l.nome,
           (select ordine from fermate where id = i.fermata_id)), false, null, p_at);
  perform avvisa_admin(l.scuola_id, 'info',
    format('Modifica tardiva: %s, %s', nome_bambino(p_bambino),
           case p_stato when 'assente' then 'assente domani' else 'assenza annullata, domani c''è' end),
    format('%s, fermata %s · segnato da %s alle %s.', l.nome, (select ordine from fermate where id = i.fermata_id), chi, ora_hhmm(p_at)),
    false, l.id, t.id, p_at);

  if t.stato in ('annullato_definitivo', 'annullato_volontari') then
    return 'Registrato. La linea però è annullata per domani.';
  end if;
  dopo := valuta_soglia(l.id, g, p_at);
  return 'Modifica tardiva: i volontari di turno sono avvisati.';
end $$;

-- Job delle 18:00: chiude le assenze del prossimo giorno di scuola e applica le soglie.
create or replace function chiudi_assenze(p_giorno date default null, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare s record; l record; g date; n int; t turni; gen record; chi_attende text;
begin
  for s in select * from scuole loop
    g := coalesce(p_giorno, giorno_riferimento(s.id, p_at + interval '1 minute'));
    if not giorno_di_scuola(s.id, g) then continue; end if;
    for l in select * from linee where scuola_id = s.id and attiva loop
      t := turno_del(l.id, g);
      perform valuta_soglia(l.id, g, p_at);
    end loop;
    -- Un promemoria per famiglia, solo per i bambini attesi su linee che partono.
    for gen in
      select b.genitore_id, string_agg(b.nome, ' e ' order by b.nome) as nomi, count(*) as n
      from bambini b join iscrizioni i on i.bambino_id = b.id and i.stato = 'approvata'
      join turni t2 on t2.linea_id = i.linea_id and t2.giorno = g
      where b.scuola_id = s.id and turno_parte(t2.stato)
        and not exists (select 1 from presenze p where p.bambino_id = b.id and p.giorno = g and p.stato = 'assente')
      group by b.genitore_id
    loop
      perform avvisa(gen.genitore_id, 'info',
        format('Domani %s %s alla fermata', gen.nomi, case when gen.n > 1 then 'sono attesi' else 'è atteso' end),
        'Assenze chiuse. Puoi ancora segnalarne una: sarà tardiva e i volontari avvisati.', false, null, null, p_at);
    end loop;
    perform avvisa_admin(s.id, 'info', format('Assenze chiuse alle %s', ora_hhmm(p_at)),
      (select string_agg(format('%s %s', l2.nome, presenti_attesi(l2.id, g)), ', ' order by l2.nome)
         from linee l2 where l2.scuola_id = s.id and l2.attiva) || '. Modifiche da ora in poi sono tardive.',
      false, null, null, p_at);
  end loop;
end $$;

-- Job delle 21:00: quel che è annullato resta annullato.
create or replace function soglia_definitiva(p_giorno date default null, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare s record; tr record; g date;
begin
  for s in select * from scuole loop
    g := coalesce(p_giorno, giorno_riferimento(s.id, p_at + interval '1 minute'));
    for tr in select t.*, l.nome as linea_nome, l.scuola_id from turni t join linee l on l.id = t.linea_id
             where l.scuola_id = s.id and t.giorno = g and t.stato = 'annullato_soglia' loop
      update turni set stato = 'annullato_definitivo' where id = tr.id;
      perform avvisa_genitori_linea(tr.linea_id, 'warn', format('%s: annullamento definitivo', tr.linea_nome),
        'Soglia non raggiunta entro le 21:00. Domani il pedibus non parte.', true, tr.id, p_at);
      perform avvisa_volontari_turno(tr.id, 'warn', format('%s: turno di domani annullato', tr.linea_nome),
        'Soglia non raggiunta entro le 21:00.', true, null, p_at);
    end loop;
    perform avvisa_admin(s.id, 'info', 'Soglie chiuse alle 21:00',
      (select string_agg(format('%s: %s presenti, %s', l.nome, coalesce(t2.presenti_attesi, presenti_attesi(l.id, g)),
                                case when turno_parte(t2.stato) then 'parte' else 'annullata' end), '. ' order by l.nome)
         from linee l left join turni t2 on t2.linea_id = l.id and t2.giorno = g
         where l.scuola_id = s.id and l.attiva) || '.', false, null, null, p_at);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Volontari: non posso venire, copro, controllo delle 6:30
-- ---------------------------------------------------------------------------
create or replace function non_posso_venire(p_turno uuid, p_at timestamptz default now()) returns text
language plpgsql security definer set search_path = public as $$
declare t turni; l linee; tv turni_volontari; chi text; n int; backups text;
begin
  select * into tv from turni_volontari where turno_id = p_turno and volontario_id = auth.uid();
  if tv.turno_id is null then
    raise exception 'Non sei assegnato a questo turno' using errcode = '42501';
  end if;
  if tv.stato = 'non_viene' then return 'Hai già avvisato.'; end if;
  select * into t from turni where id = p_turno;
  select * into l from linee where id = t.linea_id;

  update turni_volontari set stato = 'non_viene' where turno_id = p_turno and volontario_id = auth.uid();
  n := copertura(p_turno);
  select p.nome || ' ' || p.cognome into chi from persone p where p.id = auth.uid();
  select string_agg(p.nome || ' ' || p.cognome, ', ') into backups
    from turni_volontari b join persone p on p.id = b.volontario_id
    where b.turno_id = p_turno and b.ruolo = 'backup' and b.stato = 'assegnato';

  if n >= l.min_volontari then
    perform avvisa_volontari_turno(p_turno, 'info', format('%s non può venire', chi),
      format('%s, turno delle %s: restate in %s su %s, il turno è coperto.', l.nome, to_char(l.ora_partenza, 'FMHH24:MI'), n, l.min_volontari),
      false, auth.uid(), p_at);
    perform avvisa_admin(l.scuola_id, 'info', format('%s: %s non può venire', l.nome, chi),
      format('Turno delle %s ancora a %s su %s.', to_char(l.ora_partenza, 'FMHH24:MI'), n, l.min_volontari), false, l.id, p_turno, p_at);
    return 'Grazie per averlo detto: il turno resta coperto.';
  end if;

  update turni set escalation_dal = coalesce(escalation_dal, p_at) where id = p_turno;
  perform avvisa_volontari_turno(p_turno, 'warn', format('%s non può venire', chi),
    format('%s, turno delle %s: %s %s su %s. Avvisati i backup%s; dopo 10 minuti l''avviso va a tutti.',
           l.nome, to_char(l.ora_partenza, 'FMHH24:MI'), n, case when n = 1 then 'volontario' else 'volontari' end, l.min_volontari,
           case when backups is null then '' else ' (' || backups || ')' end), true, auth.uid(), p_at);
  perform avvisa_admin(l.scuola_id, 'warn', format('%s: %s non può venire', l.nome, chi),
    format('Turno delle %s a %s su %s. Escalation partita alle %s.', to_char(l.ora_partenza, 'FMHH24:MI'), n, l.min_volontari, ora_hhmm(p_at)),
    true, l.id, p_turno, p_at);
  return 'Avvisati i backup. Grazie per averlo detto subito.';
end $$;

-- Un volontario approvato (backup del turno o chiunque sia disponibile) copre il turno.
create or replace function copro_turno(p_turno uuid, p_at timestamptz default now()) returns text
language plpgsql security definer set search_path = public as $$
declare t turni; l linee; chi text; n int; ok boolean;
begin
  select * into t from turni where id = p_turno;
  select * into l from linee where id = t.linea_id;
  if not is_volontario(l.scuola_id) then
    raise exception 'Solo un volontario approvato può coprire un turno' using errcode = '42501';
  end if;
  insert into turni_volontari (turno_id, volontario_id, ruolo, stato)
  values (p_turno, auth.uid(), 'backup', 'copre')
  on conflict (turno_id, volontario_id) do update set stato = 'copre';

  n := copertura(p_turno); ok := n >= l.min_volontari;
  if ok then update turni set escalation_dal = null, escalation_allargata_il = null where id = p_turno; end if;
  select p.nome || ' ' || p.cognome into chi from persone p where p.id = auth.uid();
  perform avvisa_volontari_turno(p_turno, (case when ok then 'ok' else 'warn' end)::tipo_avviso, format('%s copre il turno', chi),
    case when ok then format('%s al completo: %s su %s%s.', l.nome, n, l.min_volontari, case when kit_presente(p_turno) then ', kit presente' else ', nessun kit' end)
         else format('%s ancora a %s su %s: l''avviso va a tutti i volontari.', l.nome, n, l.min_volontari) end,
    false, auth.uid(), p_at);
  perform avvisa_admin(l.scuola_id, (case when ok then 'ok' else 'warn' end)::tipo_avviso, format('%s copre la %s', chi, l.nome),
    case when ok then format('Turno completo%s.', case when kit_presente(p_turno) then ', kit presente' else ', nessun kit' end)
         else format('Turno ancora sotto il minimo (%s su %s).', n, l.min_volontari) end, false, l.id, p_turno, p_at);
  return case when ok then 'Grazie: il turno è coperto.' else 'Grazie. Il turno è ancora sotto il minimo.' end;
end $$;

-- Job ogni 5 minuti: escalation non coperta da più di 10 minuti → avviso a tutti i volontari della scuola.
create or replace function allarga_escalation(p_at timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare tr record; n int := 0;
begin
  for tr in select t.*, l.nome as linea_nome, l.scuola_id, l.min_volontari, l.ora_partenza
           from turni t join linee l on l.id = t.linea_id
           where t.escalation_dal is not null and t.escalation_allargata_il is null
             and t.escalation_dal <= p_at - interval '10 minutes' and turno_parte(t.stato)
  loop
    insert into avvisi (destinatario_id, tipo, titolo, corpo, sms, linea_id, turno_id, creato_il)
    select r.persona_id, 'warn'::tipo_avviso, format('%s: serve un volontario alle %s', tr.linea_nome, to_char(tr.ora_partenza, 'FMHH24:MI')),
      format('Turno del %s a %s su %s. Se puoi, apri l''app e premi «Copro il turno».', to_char(tr.giorno, 'DD/MM'), copertura(tr.id), tr.min_volontari),
      true, tr.linea_id, tr.id, p_at
    from ruoli r where r.scuola_id = tr.scuola_id and r.ruolo = 'volontario' and r.stato = 'approvata'
      and not exists (select 1 from turni_volontari tv where tv.turno_id = tr.id and tv.volontario_id = r.persona_id);
    update turni set escalation_allargata_il = p_at where id = tr.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Job delle 6:30: un'ora prima della partenza, sotto il minimo si annulla e si avvisano le famiglie.
create or replace function controllo_volontari(p_giorno date default null, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare s record; tr record; g date; n int;
begin
  for s in select * from scuole loop
    g := coalesce(p_giorno, locale(p_at)::date);
    for tr in select t.*, l.nome as linea_nome, l.min_volontari from turni t join linee l on l.id = t.linea_id
             where l.scuola_id = s.id and t.giorno = g and turno_parte(t.stato) and t.stato not in ('in_corso', 'consegnato') loop
      n := copertura(tr.id);
      if n < tr.min_volontari then
        update turni set stato = 'annullato_volontari', motivo = format('%s volontari su %s', n, tr.min_volontari) where id = tr.id;
        perform avvisa_genitori_linea(tr.linea_id, 'warn', format('%s annullata stamattina', tr.linea_nome),
          format('Volontari insufficienti (%s su %s) un''ora prima della partenza. Accompagnate i bambini voi.', n, tr.min_volontari), true, tr.id, p_at);
        perform avvisa_volontari_turno(tr.id, 'warn', format('%s annullata', tr.linea_nome),
          'Turno sotto il minimo un''ora prima della partenza. Famiglie avvisate via push e SMS.', true, null, p_at);
        perform avvisa_admin(s.id, 'warn', format('%s annullata: volontari insufficienti', tr.linea_nome),
          format('%s su %s. Famiglie avvisate alle %s.', n, tr.min_volontari, ora_hhmm(p_at)), true, tr.linea_id, tr.id, p_at);
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Appello
-- ---------------------------------------------------------------------------
create or replace function apri_appello(p_turno uuid, p_at timestamptz default now()) returns uuid
language plpgsql security definer set search_path = public as $$
declare t turni; l linee; a appelli; id_capolinea uuid;
begin
  if not di_turno(p_turno) then
    raise exception 'Solo un volontario di turno può aprire l''appello' using errcode = '42501';
  end if;
  select * into t from turni where id = p_turno;
  if not turno_parte(t.stato) then
    raise exception 'La linea è annullata: %', coalesce(t.motivo, t.stato::text) using errcode = 'P0001';
  end if;
  select * into a from appelli where turno_id = p_turno;
  if a.id is not null then return a.id; end if;
  select * into l from linee where id = t.linea_id;
  select id into id_capolinea from fermate where linea_id = l.id order by ordine limit 1;

  insert into appelli (turno_id, aperto_da, aperto_il, fermata_corrente)
  values (p_turno, auth.uid(), p_at, id_capolinea) returning * into a;
  insert into appello_bambini (appello_id, bambino_id, stato, fermata_id)
  select a.id, ba.bambino_id, 'atteso'::stato_appello_bambino, ba.fermata_id from bambini_attesi(l.id, t.giorno) ba;
  update turni set stato = 'in_corso' where id = p_turno;

  perform avvisa_volontari_turno(p_turno, 'info', 'Si parte: appello al capolinea',
    format('%s, %s · %s bambini attesi oggi · %s.', l.nome, (select nome from fermate where id = id_capolinea),
           (select count(*) from appello_bambini where appello_id = a.id), nomi_volontari(p_turno)), false, null, p_at);
  return a.id;
end $$;

-- Spunta (o toglie la spunta a) un bambino alla fermata corrente.
create or replace function segna_salito(p_appello uuid, p_bambino uuid, p_salito boolean default true, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare a appelli;
begin
  select * into a from appelli where id = p_appello;
  if a.id is null or not turno_in_corso_mio(a.turno_id) then
    raise exception 'Appello non tuo o non in corso' using errcode = '42501';
  end if;
  update appello_bambini
    set stato = (case when p_salito then 'salito' else 'atteso' end)::stato_appello_bambino,
        segnato_da = auth.uid(), segnato_il = p_at
  where appello_id = p_appello and bambino_id = p_bambino and stato in ('atteso', 'salito', 'non_trovato');
  if not found then
    raise exception 'Bambino non in lista per questo appello' using errcode = 'P0001';
  end if;
end $$;

-- Un bambino non in lista si prende solo se ha un'iscrizione approvata sulla linea.
create or replace function aggiungi_all_appello(p_appello uuid, p_bambino uuid, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare a appelli; t turni;
begin
  select * into a from appelli where id = p_appello;
  if a.id is null or not turno_in_corso_mio(a.turno_id) then
    raise exception 'Appello non tuo o non in corso' using errcode = '42501';
  end if;
  select * into t from turni where id = a.turno_id;
  if not exists (select 1 from iscrizioni i where i.bambino_id = p_bambino and i.linea_id = t.linea_id and i.stato = 'approvata') then
    raise exception 'Il bambino non è iscritto a questa linea: non si prende' using errcode = 'P0001';
  end if;
  insert into appello_bambini (appello_id, bambino_id, stato, fermata_id, segnato_da, segnato_il)
  values (p_appello, p_bambino, 'aggiunto', a.fermata_corrente, auth.uid(), p_at)
  on conflict (appello_id, bambino_id) do update
    set stato = 'aggiunto', fermata_id = excluded.fermata_id, segnato_da = excluded.segnato_da, segnato_il = excluded.segnato_il;
  -- Il bambino era segnato assente: ora è presente, con nota.
  perform avvisa_admin((select scuola_id from linee where id = t.linea_id), 'info',
    format('%s aggiunto all''appello', nome_bambino(p_bambino)),
    format('Era segnato assente, è salito alla fermata %s.', (select nome from fermate where id = a.fermata_corrente)),
    false, t.linea_id, t.id, p_at);
end $$;

-- Chi era atteso alla fermata corrente e non è salito è "non trovato": il genitore lo sa subito.
create or replace function prossima_fermata(p_appello uuid, p_at timestamptz default now()) returns uuid
language plpgsql security definer set search_path = public as $$
declare a appelli; t turni; l linee; f fermate; nxt uuid; k record;
begin
  select * into a from appelli where id = p_appello;
  if a.id is null or not turno_in_corso_mio(a.turno_id) then
    raise exception 'Appello non tuo o non in corso' using errcode = '42501';
  end if;
  select * into t from turni where id = a.turno_id;
  select * into l from linee where id = t.linea_id;
  select * into f from fermate where id = a.fermata_corrente;

  for k in select ab.bambino_id, b.genitore_id, b.nome, b.genere
           from appello_bambini ab join bambini b on b.id = ab.bambino_id
           where ab.appello_id = p_appello and ab.fermata_id = f.id and ab.stato = 'atteso' loop
    update appello_bambini set stato = 'non_trovato', segnato_da = auth.uid(), segnato_il = p_at
      where appello_id = p_appello and bambino_id = k.bambino_id;
    perform avvisa(k.genitore_id, 'warn', format('%s non era alla fermata', k.nome),
      format('%s alle %s: era %s ma non c''era. Il pedibus è ripartito.', f.nome, to_char(f.orario, 'FMHH24:MI'),
             case when k.genere = 'F' then 'attesa' else 'atteso' end), true, l.id, t.id, p_at);
    perform avvisa_admin(l.scuola_id, 'warn', format('%s non trovato alla fermata %s', nome_bambino(k.bambino_id), f.ordine),
      format('%s, %s alle %s. Genitore avvisato.', l.nome, f.nome, to_char(f.orario, 'FMHH24:MI')), false, l.id, t.id, p_at);
  end loop;

  select id into nxt from fermate where linea_id = l.id and ordine > f.ordine order by ordine limit 1;
  if nxt is null then return f.id; end if;
  update appelli set fermata_corrente = nxt where id = p_appello;
  return nxt;
end $$;

-- Consegna a scuola: da qui la responsabilità passa alla scuola. I genitori lo sanno subito.
create or replace function consegna(p_appello uuid, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare a appelli; t turni; l linee; fam record; n int;
begin
  select * into a from appelli where id = p_appello;
  if a.id is null or not di_turno(a.turno_id) then
    raise exception 'Appello non tuo' using errcode = '42501';
  end if;
  if a.consegnato_il is not null then return; end if;   -- già consegnato: niente doppi avvisi
  select * into t from turni where id = a.turno_id;
  if t.stato <> 'in_corso' then
    raise exception 'Appello non in corso' using errcode = 'P0001';
  end if;
  select * into l from linee where id = t.linea_id;
  select count(*) into n from appello_bambini where appello_id = p_appello and stato in ('salito', 'aggiunto');

  update appelli set consegnato_il = p_at, consegnato_da = auth.uid() where id = p_appello;
  update turni set stato = 'consegnato' where id = t.id;

  for fam in select b.genitore_id,
                    string_agg(b.nome, ' e ' order by b.nome) as nomi, count(*) as k,
                    bool_and(b.genere = 'F') as tutte_f
             from appello_bambini ab join bambini b on b.id = ab.bambino_id
             where ab.appello_id = p_appello and ab.stato in ('salito', 'aggiunto')
             group by b.genitore_id loop
    perform avvisa(fam.genitore_id, 'ok',
      format('%s %s a scuola alle %s', fam.nomi,
             case when fam.k > 1 then (case when fam.tutte_f then 'sono state consegnate' else 'sono stati consegnati' end)
                  else (case when fam.tutte_f then 'è stata consegnata' else 'è stato consegnato' end) end, ora_hhmm(p_at)),
      format('%s · %s bambini consegnati · volontari: %s.', l.nome, n, nomi_volontari(t.id)), false, l.id, t.id, p_at);
  end loop;
  perform avvisa_admin(l.scuola_id, 'ok', format('%s consegnata alle %s', l.nome, ora_hhmm(p_at)),
    format('%s bambini a scuola. Appello chiuso da %s.', n, nomi_volontari(t.id)), false, l.id, t.id, p_at);
end $$;

-- Contatti d'emergenza: solo di turno, e la consultazione resta registrata.
create or replace function contatti_emergenza_turno(p_turno uuid, p_at timestamptz default now())
returns table (bambino_id uuid, bambino text, nome text, relazione text, telefono text)
language plpgsql security definer set search_path = public as $$
declare t turni;
begin
  if not turno_in_corso_mio(p_turno) then
    raise exception 'I contatti si vedono solo durante il proprio turno' using errcode = '42501';
  end if;
  select * into t from turni where id = p_turno;
  insert into accessi_contatti (persona_id, bambino_id, turno_id, consultato_il)
  select auth.uid(), ba.bambino_id, p_turno, p_at from bambini_attesi(t.linea_id, t.giorno) ba;
  return query
    select c.bambino_id, nome_bambino(c.bambino_id), c.nome, c.relazione, c.telefono
    from contatti_emergenza c
    where c.bambino_id in (select ba.bambino_id from bambini_attesi(t.linea_id, t.giorno) ba)
    order by 2, c.ordine;
end $$;

-- ---------------------------------------------------------------------------
-- Amministrazione: iscrizioni e ruoli
-- ---------------------------------------------------------------------------
create or replace function decidi_iscrizione(p_iscrizione uuid, p_stato stato_approvazione, p_motivo text default null, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare i iscrizioni; b bambini; l linee;
begin
  select * into i from iscrizioni where id = p_iscrizione;
  select * into b from bambini where id = i.bambino_id;
  if not is_admin(b.scuola_id) then
    raise exception 'Solo l''amministratore decide le iscrizioni' using errcode = '42501';
  end if;
  update iscrizioni set stato = p_stato, decisa_da = auth.uid(), decisa_il = p_at, motivo_rifiuto = p_motivo where id = p_iscrizione;
  -- Il genitore principale diventa (o resta) genitore approvato della scuola.
  if p_stato = 'approvata' then
    insert into ruoli (persona_id, scuola_id, ruolo, stato, deciso_da, deciso_il)
    values (b.genitore_id, b.scuola_id, 'genitore', 'approvata', auth.uid(), p_at)
    on conflict (persona_id, scuola_id, ruolo) do update set stato = 'approvata', deciso_da = excluded.deciso_da, deciso_il = excluded.deciso_il;
  end if;
  select * into l from linee where id = i.linea_id;
  perform avvisa(b.genitore_id, (case when p_stato = 'approvata' then 'ok' else 'warn' end)::tipo_avviso,
    format('Iscrizione di %s %s', b.nome, case when p_stato = 'approvata' then 'approvata' else 'rifiutata' end),
    case when p_stato = 'approvata'
      then format('%s, fermata %s. Da domani è atteso alla fermata salvo avviso.', l.nome, (select nome from fermate where id = i.fermata_id))
      else coalesce(p_motivo, 'Contatta l''amministratore per i dettagli.') end, false, l.id, null, p_at);
end $$;

create or replace function decidi_ruolo(p_persona uuid, p_scuola uuid, p_ruolo ruolo_tipo, p_stato stato_approvazione, p_note text default null, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(p_scuola) then
    raise exception 'Solo l''amministratore decide i ruoli' using errcode = '42501';
  end if;
  update ruoli set stato = p_stato, note = coalesce(p_note, note), deciso_da = auth.uid(), deciso_il = p_at
  where persona_id = p_persona and scuola_id = p_scuola and ruolo = p_ruolo;
  perform avvisa(p_persona, (case when p_stato = 'approvata' then 'ok' else 'warn' end)::tipo_avviso,
    format('Ruolo di %s %s', p_ruolo, case when p_stato = 'approvata' then 'approvato' else 'rifiutato' end),
    coalesce(p_note, ''), false, null, null, p_at);
end $$;

-- ---------------------------------------------------------------------------
-- Disponibilità, eccezioni, bozza mensile
-- ---------------------------------------------------------------------------
-- Settimana tipo: sostituisce l'insieme dei giorni (0 = lunedì … 4 = venerdì).
create or replace function imposta_disponibilita(p_giorni smallint[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_volontario() then raise exception 'Solo un volontario' using errcode = '42501'; end if;
  delete from disponibilita where volontario_id = auth.uid();
  insert into disponibilita (volontario_id, giorno) select auth.uid(), unnest(p_giorni);
end $$;

-- Un giorno diverso dal solito. p_tipo null = toglie l'eccezione.
-- Se per quel mese esiste già una bozza, la bozza non cambia da sola: l'admin è avvisato.
create or replace function segna_eccezione(p_giorno date, p_tipo tipo_eccezione, p_at timestamptz default now()) returns text
language plpgsql security definer set search_path = public as $$
declare bz bozze_turni; chi text; s uuid;
begin
  if not is_volontario() then raise exception 'Solo un volontario' using errcode = '42501'; end if;
  if p_tipo is null then
    delete from eccezioni_disponibilita where volontario_id = auth.uid() and giorno = p_giorno;
  else
    insert into eccezioni_disponibilita (volontario_id, giorno, tipo, creata_il) values (auth.uid(), p_giorno, p_tipo, p_at)
    on conflict (volontario_id, giorno) do update set tipo = excluded.tipo, creata_il = excluded.creata_il;
  end if;
  select r.scuola_id into s from ruoli r where r.persona_id = auth.uid() and r.ruolo = 'volontario' and r.stato = 'approvata' limit 1;
  select * into bz from bozze_turni where scuola_id = s and mese = date_trunc('month', p_giorno)::date;
  if bz.id is null then
    return case when p_tipo is null then 'Eccezione tolta.'
                when p_tipo = 'assente' then format('%s: non ci sei. La bozza ne terrà conto.', to_char(p_giorno, 'DD/MM'))
                else format('%s: ci sei in più. La bozza ne terrà conto.', to_char(p_giorno, 'DD/MM')) end;
  end if;
  update bozze_turni set stale = true where id = bz.id;
  select p.nome || ' ' || p.cognome into chi from persone p where p.id = auth.uid();
  perform avvisa_admin(s, 'warn', format('%s: disponibilità cambiata dopo la bozza', chi),
    format('%s: %s. Rigenera la bozza o correggi a mano.', to_char(p_giorno, 'DD/MM'),
           case when p_tipo is null then 'eccezione tolta' when p_tipo = 'assente' then 'non c''è' else 'c''è in più' end), false, null, null, p_at);
  return 'Segnato. La bozza è già stata fatta: l''amministratore è avvisato.';
end $$;

create or replace function disponibile_il(p_volontario uuid, p_giorno date) returns boolean
language sql stable as $$
  select coalesce(
    (select e.tipo = 'presente' from eccezioni_disponibilita e where e.volontario_id = p_volontario and e.giorno = p_giorno),
    exists (select 1 from disponibilita d where d.volontario_id = p_volontario and d.giorno = extract(isodow from p_giorno) - 1))
$$;

-- Bozza del mese: greedy e deterministica. Per ogni giorno di scuola e linea:
-- titolari fra i disponibili (prima chi ha il kit se nessuno ce l'ha, poi chi ha meno turni nel mese),
-- fino a volontari_consigliati, mai più di 2 turni a settimana a testa; un backup fra i restanti.
-- È un segnaposto onesto per l'algoritmo a vincoli: rispetta i vincoli duri, non ottimizza.
create or replace function genera_bozza(p_scuola uuid, p_mese date, p_at timestamptz default now()) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  bz bozze_turni; g date; l record; t turni; v record;
  assegnati int; kit_ok boolean; carico jsonb := '{}'; settimana jsonb := '{}'; key text; wk text;
begin
  if not is_admin(p_scuola) then raise exception 'Solo l''amministratore genera la bozza' using errcode = '42501'; end if;
  p_mese := date_trunc('month', p_mese)::date;
  insert into bozze_turni (scuola_id, mese, generata_il, generata_da)
  values (p_scuola, p_mese, p_at, auth.uid())
  on conflict (scuola_id, mese) do update set stato = 'bozza', generata_il = excluded.generata_il, generata_da = excluded.generata_da, stale = false, inviata_il = null, pubblicata_il = null
  returning * into bz;
  -- Si rigenera da zero: via le assegnazioni dei turni futuri di questa bozza.
  delete from turni_volontari tv using turni tt where tv.turno_id = tt.id and tt.bozza_id = bz.id and tt.giorno > locale(p_at)::date;

  g := p_mese;
  while g < p_mese + interval '1 month' loop
    if giorno_di_scuola(p_scuola, g) and g > locale(p_at)::date then
      wk := to_char(g, 'IYYY-IW');
      for l in select * from linee where scuola_id = p_scuola and attiva order by ora_partenza, nome loop
        t := turno_del(l.id, g);
        update turni set bozza_id = bz.id where id = t.id;
        assegnati := 0; kit_ok := false;
        for v in
          select r.persona_id, exists (select 1 from dotazioni d where d.volontario_id = r.persona_id and d.tipo = 'kit' and d.restituita_il is null) as kit
          from ruoli r
          where r.scuola_id = p_scuola and r.ruolo = 'volontario' and r.stato = 'approvata'
            and disponibile_il(r.persona_id, g)
            and not exists (select 1 from turni_volontari tv join turni t2 on t2.id = tv.turno_id where tv.volontario_id = r.persona_id and t2.giorno = g)
          order by coalesce((settimana ->> (wk || ':' || r.persona_id))::int, 0),
                   coalesce((carico ->> r.persona_id::text)::int, 0),
                   exists (select 1 from dotazioni d where d.volontario_id = r.persona_id and d.tipo = 'kit' and d.restituita_il is null) desc,
                   r.persona_id
        loop
          key := wk || ':' || v.persona_id;
          if assegnati < l.volontari_consigliati and coalesce((settimana ->> key)::int, 0) < 2 and (assegnati < l.min_volontari or not kit_ok or v.kit) then
            insert into turni_volontari (turno_id, volontario_id, ruolo) values (t.id, v.persona_id, 'titolare');
            assegnati := assegnati + 1; kit_ok := kit_ok or v.kit;
            carico := jsonb_set(carico, array[v.persona_id::text], to_jsonb(coalesce((carico ->> v.persona_id::text)::int, 0) + 1));
            settimana := jsonb_set(settimana, array[key], to_jsonb(coalesce((settimana ->> key)::int, 0) + 1));
          elsif assegnati >= l.min_volontari and not exists (select 1 from turni_volontari tv where tv.turno_id = t.id and tv.ruolo = 'backup') then
            insert into turni_volontari (turno_id, volontario_id, ruolo) values (t.id, v.persona_id, 'backup');
          end if;
        end loop;
      end loop;
    end if;
    g := g + 1;
  end loop;
  return bz.id;
end $$;

create or replace function invia_bozza(p_bozza uuid, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare bz bozze_turni;
begin
  select * into bz from bozze_turni where id = p_bozza;
  if not is_admin(bz.scuola_id) then raise exception 'Solo l''amministratore' using errcode = '42501'; end if;
  update bozze_turni set stato = 'inviata', inviata_il = p_at, scadenza_silenzio_assenso = locale(p_at)::date + 3 where id = p_bozza;
  insert into avvisi (destinatario_id, tipo, titolo, corpo, creato_il)
  select r.persona_id, 'info'::tipo_avviso, format('Turni di %s: la bozza è pronta', mese_it(bz.mese)),
    format('Guarda i tuoi turni nell''app. Chi non risponde entro il %s conferma per silenzio-assenso.', to_char(locale(p_at)::date + 3, 'DD/MM')), p_at
  from ruoli r where r.scuola_id = bz.scuola_id and r.ruolo = 'volontario' and r.stato = 'approvata';
end $$;

create or replace function pubblica_bozza(p_bozza uuid, p_at timestamptz default now()) returns void
language plpgsql security definer set search_path = public as $$
declare bz bozze_turni;
begin
  select * into bz from bozze_turni where id = p_bozza;
  if not is_admin(bz.scuola_id) then raise exception 'Solo l''amministratore' using errcode = '42501'; end if;
  update bozze_turni set stato = 'pubblicata', pubblicata_il = p_at where id = p_bozza;
end $$;

-- ---------------------------------------------------------------------------
-- Iscrizione (RPC del genitore): registra bambino + iscrizione in attesa, avvisa l'admin.
-- ---------------------------------------------------------------------------
create or replace function iscrivi_bambino(
  p_scuola uuid, p_nome text, p_cognome text, p_classe text, p_genere char,
  p_linea uuid, p_fermata uuid, p_informativa uuid,
  p_contatti jsonb default '[]', p_at timestamptz default now()) returns uuid
language plpgsql security definer set search_path = public as $$
declare b bambini; c jsonb; chi text;
begin
  if auth.uid() is null then raise exception 'Devi essere autenticato' using errcode = '42501'; end if;
  if not exists (select 1 from fermate f where f.id = p_fermata and f.linea_id = p_linea and not f.arrivo) then
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
  perform avvisa_admin(p_scuola, 'info', format('Nuova iscrizione da %s', chi),
    format('%s %s · %s, %s. Da approvare.', p_nome, p_cognome, (select nome from linee where id = p_linea), (select nome from fermate where id = p_fermata)),
    false, p_linea, null, p_at);
  return b.id;
end $$;
