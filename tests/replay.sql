-- =============================================================================
-- Rigioca il martedì della demo contro lo schema e verifica chi vede cosa.
-- Si lancia con tests/run.sh. Ogni passo: ci si "logga" come una persona
-- (ruolo authenticated + claim sub, come fa PostgREST), si fa l'azione, si verifica.
-- I job girano come postgres, come farà pg_cron.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on

-- id del seed
\set giulia  '''a0000000-0000-4000-8000-000000000001'''
\set rita    '''a0000000-0000-4000-8000-000000000002'''
\set marta   '''a0000000-0000-4000-8000-000000000003'''
\set paolo   '''a0000000-0000-4000-8000-000000000004'''
\set anna    '''a0000000-0000-4000-8000-000000000005'''
\set giorgio '''a0000000-0000-4000-8000-000000000006'''
\set elena   '''a0000000-0000-4000-8000-000000000007'''
\set admin   '''a0000000-0000-4000-8000-000000000009'''
\set greco   '''a0000000-0000-4000-8000-000000000014'''
\set karimi  '''a0000000-0000-4000-8000-000000000025'''
\set mcolombo '''a0000000-0000-4000-8000-000000000027'''
\set luca    '''b0000000-0000-4000-8000-000000000001'''
\set sofia   '''b0000000-0000-4000-8000-000000000002'''
\set matteo  '''b0000000-0000-4000-8000-000000000003'''
\set emma    '''b0000000-0000-4000-8000-000000000004'''
\set giacomo '''b0000000-0000-4000-8000-000000000005'''
\set aurora  '''b0000000-0000-4000-8000-000000000006'''
\set leo     '''b0000000-0000-4000-8000-000000000007'''
\set chiara  '''b0000000-0000-4000-8000-000000000008'''
\set tommaso '''b0000000-0000-4000-8000-000000000009'''
\set alice   '''b0000000-0000-4000-8000-000000000010'''
\set davide  '''b0000000-0000-4000-8000-000000000011'''
\set sara    '''b0000000-0000-4000-8000-000000000012'''
\set yasmin  '''b0000000-0000-4000-8000-000000000018'''
\set verde   '''c0000000-0000-4000-8000-000000000001'''
\set blu     '''c0000000-0000-4000-8000-000000000002'''
\set scuola  '''e0000000-0000-4000-8000-000000000001'''
\set t_verde '''f0000000-0000-4000-8000-000000000001'''
\set t_blu   '''f0000000-0000-4000-8000-000000000002'''

-- "Oggi" per la RLS del volontario di turno
set pedibus.oggi = '2026-10-27';

-- Strumenti di test
create or replace function verifica(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if not coalesce(p_ok, false) then raise exception 'VERIFICA FALLITA: %', p_msg; end if; end $$;

create or replace function deve_fallire(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    return;   -- doveva fallire: bene
  end;
  raise exception 'VERIFICA FALLITA: doveva essere rifiutato · %', p_msg;
end $$;

create or replace function titoli_avvisi(p_persona uuid) returns text language sql stable security definer as $$
  select coalesce(string_agg(titolo, ' | ' order by creato_il, id), '') from avvisi where destinatario_id = p_persona
$$;

create or replace function come(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false)
$$;

-- ---------------------------------------------------------------------------
\echo '  · lun 17:30  Giulia apre Presenze: vede solo i suoi, segna Sofia assente'
-- ---------------------------------------------------------------------------
set role authenticated;
select come(:giulia);

select verifica((select count(*) from bambini) = 2, 'Giulia vede solo i suoi 2 bambini');
select verifica((select count(*) from turni) = 2, 'Giulia vede i turni di Verde e Blu (ha un bambino su ciascuna)');
select verifica((select count(*) from turni_volontari) = 0, 'Giulia non vede chi è di turno');
select verifica((select count(*) from presenze) = 0, 'Giulia non vede le assenze degli altri');
select verifica((select count(*) from contatti_emergenza) = 4, 'Giulia vede i contatti dei suoi bambini');
select verifica((select count(*) from avvisi) = 0, 'Giulia non ha ancora avvisi');
select verifica(segna_presenza(:sofia, 'assente', '2026-10-27', '2026-10-26 17:30+01') = 'Assenza segnalata.', 'assenza di Sofia prima delle 18:00');
select verifica((select not tardiva from presenze where bambino_id = :sofia), 'non è tardiva');
select deve_fallire(format('select segna_presenza(%L, %L, %L, %L)', :matteo, 'assente', '2026-10-27', '2026-10-26 17:31+01'), 'Giulia non può segnare Matteo');

-- La nonna delegata: solo presenze, niente contatti, niente avvisi di Giulia
select come(:rita);
select verifica((select count(*) from bambini) = 2, 'Rita (delegata) vede i 2 bambini di Giulia');
select verifica((select count(*) from contatti_emergenza) = 0, 'Rita non vede i contatti d''emergenza');
select verifica((select count(*) from avvisi) = 0, 'Rita non vede gli avvisi di Giulia');
select verifica(segna_presenza(:luca, 'assente', '2026-10-27', '2026-10-26 17:40+01') = 'Assenza segnalata.', 'Rita può segnare Luca');
select verifica(segna_presenza(:luca, 'presente', '2026-10-27', '2026-10-26 17:41+01') = 'Assenza annullata.', '…e annullare');
reset role;

-- ---------------------------------------------------------------------------
\echo '  · lun 18:00  chiusura assenze: Verde 9 parte, Blu 3 annullata'
-- ---------------------------------------------------------------------------
select chiudi_assenze('2026-10-27', '2026-10-26 18:00+01');
select verifica((select stato from turni where id = :t_verde) = 'programmato', 'Verde parte');
select verifica((select stato from turni where id = :t_blu) = 'annullato_soglia', 'Blu annullata sotto soglia');
select verifica((select presenti_attesi from turni where id = :t_blu) = 3, 'Blu: 3 presenti fotografati');

set role authenticated;
select come(:giulia);
select verifica(titoli_avvisi(:giulia) = 'Linea Blu annullata per domani | Domani Luca è atteso alla fermata', 'avvisi di Giulia alle 18:00: ' || titoli_avvisi(:giulia));
select verifica((select sms from avvisi where titolo = 'Linea Blu annullata per domani'), 'l''annullamento va anche via SMS');
select come(:marta);
select verifica((select count(*) from avvisi) = 0, 'Marta (Verde) non riceve nulla sulla Blu');
select come(:giorgio);
select verifica(titoli_avvisi(:giorgio) = 'Linea Blu annullata per domani', 'Giorgio (Blu) è avvisato');
select come(:admin);
select verifica(titoli_avvisi(:admin) = 'Linea Blu sotto soglia | Assenze chiuse alle 18:00', 'avvisi admin: ' || titoli_avvisi(:admin));
reset role;

-- ---------------------------------------------------------------------------
\echo '  · lun 20:40  modifica tardiva: Giulia annulla l''assenza di Sofia, la Blu si riattiva'
-- ---------------------------------------------------------------------------
set role authenticated;
select come(:giulia);
select verifica(segna_presenza(:sofia, 'presente', '2026-10-27', '2026-10-26 20:40+01') like 'Modifica tardiva%', 'modifica tardiva accettata');
select verifica((select tardiva from presenze where bambino_id = :sofia), 'segnata come tardiva');
select verifica(titoli_avvisi(:giulia) like '%| Linea Blu riattivata', 'Giulia sa che la Blu è riattivata');
select come(:giorgio);
select verifica(titoli_avvisi(:giorgio) = 'Linea Blu annullata per domani | Sofia Bianchi: assenza annullata, domani c''è (modifica tardiva) | Linea Blu riattivata', 'avvisi di Giorgio: ' || titoli_avvisi(:giorgio));
select come(:admin);
select verifica(titoli_avvisi(:admin) like '%| Modifica tardiva: Sofia Bianchi, assenza annullata, domani c''è | Linea Blu riattivata', 'admin vede modifica e riattivazione');
reset role;
select verifica((select stato from turni where id = :t_blu) = 'riattivato', 'Blu riattivata');

-- ---------------------------------------------------------------------------
\echo '  · lun 21:00  soglia definitiva: entrambe partono'
-- ---------------------------------------------------------------------------
select soglia_definitiva('2026-10-27', '2026-10-26 21:00+01');
select verifica((select stato from turni where id = :t_blu) = 'riattivato', 'la Blu resta riattivata');
select verifica((select corpo from avvisi where destinatario_id = :admin and titolo = 'Soglie chiuse alle 21:00') = 'Linea Blu: 4 presenti, parte. Linea Verde: 9 presenti, parte.', 'riepilogo admin 21:00');

-- Il caso opposto, su una linea finta: sotto soglia alle 21:00 → annullata definitiva
do $$
declare l uuid; t turni;
begin
  insert into linee (scuola_id, nome, ora_partenza) values ('e0000000-0000-4000-8000-000000000001', 'Linea Test', '07:40') returning id into l;
  t := turno_del(l, '2026-10-28');
  perform valuta_soglia(l, '2026-10-28', '2026-10-27 18:00+01');
  perform verifica((select stato from turni where id = t.id) = 'annullato_soglia', 'linea senza iscritti: annullata alle 18:00');
  perform soglia_definitiva('2026-10-28', '2026-10-27 21:00+01');
  perform verifica((select stato from turni where id = t.id) = 'annullato_definitivo', '…e definitiva alle 21:00');
  perform verifica(valuta_soglia(l, '2026-10-28', '2026-10-27 21:30+01') = 'annullato_definitivo', 'dopo le 21:00 non si riattiva');
  delete from avvisi where linea_id = l or turno_id = t.id; delete from turni where id = t.id; delete from linee where id = l;
end $$;

-- ---------------------------------------------------------------------------
\echo '  · mar 6:30   controllo volontari: tutto coperto, nessun annullamento'
-- ---------------------------------------------------------------------------
select controllo_volontari('2026-10-27', '2026-10-27 06:30+01');
select verifica((select count(*) from turni where giorno = '2026-10-27' and stato = 'annullato_volontari') = 0, 'nessuna linea annullata per volontari');

-- ---------------------------------------------------------------------------
\echo '  · mar 6:50   Paolo non può venire: Verde a 1 su 2, backup avvisati'
-- ---------------------------------------------------------------------------
set role authenticated;
select come(:paolo);
select verifica(non_posso_venire(:t_verde, '2026-10-27 06:50+01') = 'Avvisati i backup. Grazie per averlo detto subito.', 'Paolo avvisa');
select verifica(non_posso_venire(:t_verde, '2026-10-27 06:51+01') = 'Hai già avvisato.', 'idempotente');
select deve_fallire(format('select non_posso_venire(%L, %L)', :t_blu, '2026-10-27 06:52+01'), 'Paolo non è sulla Blu');
select come(:anna);
select verifica(titoli_avvisi(:anna) = 'Paolo Verdi non può venire', 'Anna (backup) è avvisata');
select verifica((select sms from avvisi where titolo = 'Paolo Verdi non può venire'), '…anche via SMS');
select come(:marta);
select verifica(titoli_avvisi(:marta) = 'Paolo Verdi non può venire', 'Marta è avvisata');
select come(:paolo);
select verifica(titoli_avvisi(:paolo) = '', 'Paolo non riceve il proprio avviso');
reset role;
select verifica(copertura(:t_verde) = 1, 'copertura Verde = 1');
select verifica((select escalation_dal from turni where id = :t_verde) = '2026-10-27 06:50+01', 'escalation partita alle 6:50');
select verifica(allarga_escalation('2026-10-27 06:55+01') = 0, 'a 5 minuti non si allarga ancora');

-- ---------------------------------------------------------------------------
\echo '  · mar 7:00   Anna copre: Verde 2 su 2, kit presente'
-- ---------------------------------------------------------------------------
set role authenticated;
select come(:anna);
select verifica(copro_turno(:t_verde, '2026-10-27 07:00+01') = 'Grazie: il turno è coperto.', 'Anna copre');
select come(:giulia);
select deve_fallire(format('select copro_turno(%L, %L)', :t_verde, '2026-10-27 07:01+01'), 'un genitore non può coprire un turno');
select come(:marta);
select verifica(titoli_avvisi(:marta) = 'Paolo Verdi non può venire | Anna Ferrari copre il turno', 'Marta sa che Anna copre');
reset role;
select verifica(copertura(:t_verde) = 2 and kit_presente(:t_verde), 'Verde 2 su 2 con kit');
select verifica(allarga_escalation('2026-10-27 07:05+01') = 0, 'escalation chiusa: niente avviso a tutti');
select verifica((select corpo from avvisi where destinatario_id = :admin and titolo = 'Anna Ferrari copre la Linea Verde') = 'Turno completo, kit presente.', 'admin: turno completo');

-- L'escalation che nessuno copre: dopo 10 minuti l'avviso va a tutti i volontari
do $$
declare t turni; n int;
begin
  t := turno_del('c0000000-0000-4000-8000-000000000001', '2026-10-28');
  insert into turni_volontari (turno_id, volontario_id, ruolo) values (t.id, 'a0000000-0000-4000-8000-000000000003', 'titolare'), (t.id, 'a0000000-0000-4000-8000-000000000004', 'titolare');
  update turni_volontari set stato = 'non_viene' where turno_id = t.id and volontario_id = 'a0000000-0000-4000-8000-000000000004';
  update turni set escalation_dal = '2026-10-28 06:40+01' where id = t.id;
  perform verifica(allarga_escalation('2026-10-28 06:49+01') = 0, 'a 9 minuti no');
  perform verifica(allarga_escalation('2026-10-28 06:51+01') = 1, 'a 11 minuti sì');
  select count(*) into n from avvisi where turno_id = t.id and titolo like 'Linea Verde: serve un volontario%';
  perform verifica(n = 4, format('avviso a tutti i volontari non già sul turno (4, trovati %s)', n));
  perform controllo_volontari('2026-10-28', '2026-10-28 06:30+01');
  perform verifica((select stato from turni where id = t.id) = 'annullato_volontari', 'alle 6:30 con 1 su 2 la linea si annulla');
  delete from avvisi where turno_id = t.id; delete from turni where id = t.id;
end $$;

-- ---------------------------------------------------------------------------
\echo '  · mar 7:30   Marta apre l''appello e fa il giro: 9 attesi, Davide aggiunto, Leonardo non trovato'
-- ---------------------------------------------------------------------------
set role authenticated;
select come(:giulia);
select deve_fallire(format('select apri_appello(%L, %L)', :t_verde, '2026-10-27 07:29+01'), 'un genitore non apre l''appello');
select come(:marta);
select verifica((select count(*) from bambini) = 10, 'Marta di turno vede i 10 iscritti della Verde (oggi)');
select verifica((select count(*) from contatti_emergenza) = 0, 'Marta non vede i contatti via tabella');
select verifica((select count(*) from presenze) = 0, 'Marta non vede le presenze via tabella');
select verifica((select count(*) from turni_volontari) = 6, 'Marta vede chi è di turno nella sua scuola');
select verifica((select count(*) from avvisi) = 2, 'Marta vede solo i propri avvisi');
select apri_appello(:t_verde, '2026-10-27 07:30+01') as appello \gset
select verifica((select count(*) from appello_bambini where appello_id = :'appello') = 9, '9 bambini attesi');
select verifica((select stato from turni where id = :t_verde) = 'in_corso', 'turno in corso');
select verifica((select count(*) from contatti_emergenza_turno(:t_verde, '2026-10-27 07:31+01')) = 2, 'contatti di Luca visibili durante il turno (2)');
reset role;
select verifica((select count(*) from accessi_contatti where persona_id = :marta) = 9, 'consultazione registrata per i 9 attesi');
set role authenticated;
select come(:marta);
-- Fermata 1: Emma e Giacomo
select segna_salito(:'appello', :emma, true, '2026-10-27 07:31+01');
select segna_salito(:'appello', :giacomo, true, '2026-10-27 07:31+01');
select prossima_fermata(:'appello', '2026-10-27 07:35+01');
-- Fermata 2: Matteo e Tommaso
select segna_salito(:'appello', :matteo, true, '2026-10-27 07:37+01');
select segna_salito(:'appello', :tommaso, true, '2026-10-27 07:37+01');
select prossima_fermata(:'appello', '2026-10-27 07:40+01');
-- Fermata 3: Luca; Davide era assente ma è lì → si aggiunge (è iscritto alla Verde)
select segna_salito(:'appello', :luca, true, '2026-10-27 07:43+01');
select aggiungi_all_appello(:'appello', :davide, '2026-10-27 07:43+01');
select deve_fallire(format('select aggiungi_all_appello(%L, %L, %L)', :'appello', :sara, '2026-10-27 07:44+01'), 'Sara è della Blu: non si prende');
select prossima_fermata(:'appello', '2026-10-27 07:46+01');
-- Fermata 4: Aurora sì, Leonardo non c'è
select segna_salito(:'appello', :aurora, true, '2026-10-27 07:49+01');
select prossima_fermata(:'appello', '2026-10-27 07:51+01');
-- Fermata 5: Chiara e Alice
select segna_salito(:'appello', :chiara, true, '2026-10-27 07:54+01');
select segna_salito(:'appello', :alice, true, '2026-10-27 07:54+01');
select prossima_fermata(:'appello', '2026-10-27 07:57+01');
select verifica((select f.arrivo from appelli a join fermate f on f.id = a.fermata_corrente where a.id = :'appello'), 'siamo all''arrivo');
select verifica((select count(*) from appello_bambini where appello_id = :'appello' and stato in ('salito', 'aggiunto')) = 9, '9 a bordo (8 saliti + Davide)');
select verifica((select stato from appello_bambini where appello_id = :'appello' and bambino_id = :leo) = 'non_trovato', 'Leonardo non trovato');
select consegna(:'appello', '2026-10-27 08:02+01');
select consegna(:'appello', '2026-10-27 08:03+01');   -- idempotente
reset role;
select verifica((select stato from turni where id = :t_verde) = 'consegnato', 'Verde consegnata');
select verifica(titoli_avvisi(:greco) = 'Domani Leonardo è atteso alla fermata | Leonardo non era alla fermata', 'i Greco sanno subito di Leonardo: ' || titoli_avvisi(:greco));
select verifica((select sms from avvisi where destinatario_id = :greco and titolo = 'Leonardo non era alla fermata'), '…via SMS');

-- ---------------------------------------------------------------------------
\echo '  · mar 7:35   la Blu fa il suo giro con Giorgio; alle 8:00 Giulia ha due consegne'
-- ---------------------------------------------------------------------------
set role authenticated;
select come(:giorgio);
select apri_appello(:t_blu, '2026-10-27 07:35+01') as appello_blu \gset
select verifica((select count(*) from appello_bambini where appello_id = :'appello_blu') = 4, 'Blu: 4 attesi');
do $$
declare a uuid := (select id from appelli where turno_id = 'f0000000-0000-4000-8000-000000000002'); k record; i int;
begin
  for i in 1..4 loop
    for k in select ab.bambino_id from appello_bambini ab join appelli ap on ap.id = ab.appello_id
             where ab.appello_id = a and ab.fermata_id = ap.fermata_corrente and ab.stato = 'atteso' loop
      perform segna_salito(a, k.bambino_id, true, '2026-10-27 07:40+01');
    end loop;
    perform prossima_fermata(a, '2026-10-27 07:45+01');
  end loop;
  perform consegna(a, '2026-10-27 08:01+01');
end $$;
select come(:giulia);
select verifica(titoli_avvisi(:giulia) like '%| Sofia è stata consegnata a scuola alle 8:01 | Luca è stato consegnato a scuola alle 8:02', 'Giulia: ' || titoli_avvisi(:giulia));
select verifica((select count(*) from appello_bambini) = 2, 'Giulia vede solo le righe d''appello dei suoi');
reset role;

-- ---------------------------------------------------------------------------
\echo '  · amministrazione: iscrizioni e ruoli'
-- ---------------------------------------------------------------------------
set role authenticated;
select come(:admin);
select verifica((select count(*) from bambini) = 20, 'l''admin vede tutti i bambini');
select verifica((select count(*) from iscrizioni where stato = 'in_attesa') = 3, '3 iscrizioni in attesa');
select decidi_iscrizione((select id from iscrizioni where bambino_id = :yasmin), 'approvata', null, '2026-10-27 09:00+01');
select decidi_ruolo(:mcolombo, :scuola, 'volontario', 'rifiutata', 'Non risulta nell''albo dei volontari civici', '2026-10-27 09:05+01');
select come(:karimi);
select verifica((select stato from ruoli where persona_id = :karimi and ruolo = 'genitore') = 'approvata', 'Karimi è genitore approvato');
select verifica(titoli_avvisi(:karimi) = 'Iscrizione di Yasmin approvata', 'Karimi avvisato');
select verifica((select count(*) from turni) = 1, 'Karimi ora vede il turno della Blu');
select come(:mcolombo);
select verifica(titoli_avvisi(:mcolombo) = 'Ruolo di volontario rifiutato', 'Marco Colombo avvisato del rifiuto');
select verifica((select count(*) from turni) = 0, 'e non vede turni');
select come(:giulia);
select deve_fallire(format('select decidi_iscrizione(%L, %L)', (select id from iscrizioni where bambino_id = :yasmin), 'rifiutata'), 'un genitore non decide le iscrizioni');
reset role;

-- ---------------------------------------------------------------------------
\echo '  · bozza di novembre: generata, inviata, poi un''eccezione la rende da rivedere'
-- ---------------------------------------------------------------------------
set role authenticated;
select come(:admin);
select genera_bozza(:scuola, '2026-11-01', '2026-10-28 09:00+01') as bozza \gset
reset role;
select verifica((select count(*) from turni where bozza_id = :'bozza') = 42, '21 giorni di scuola × 2 linee = 42 turni');
select verifica(not exists (
  select 1 from turni_volontari tv join turni t on t.id = tv.turno_id
  where t.bozza_id = :'bozza' and tv.ruolo = 'titolare'
  group by tv.volontario_id, to_char(t.giorno, 'IYYY-IW') having count(*) > 2), 'nessuno più di 2 turni a settimana');
select verifica(not exists (
  select 1 from turni_volontari tv join turni t on t.id = tv.turno_id
  where t.bozza_id = :'bozza' group by t.id, tv.volontario_id having count(*) > 1), 'nessuno due volte sullo stesso turno');
select verifica((select count(*) from turni t where t.bozza_id = :'bozza' and copertura(t.id) >= 2) > 0, 'ci sono turni coperti');
set role authenticated;
select come(:admin);
select invia_bozza(:'bozza', '2026-10-28 09:30+01');
select come(:marta);
select verifica(titoli_avvisi(:marta) like '%| Turni di %: la bozza è pronta', 'Marta riceve la bozza');
select verifica(segna_eccezione('2026-11-10', 'assente', '2026-10-29 20:00+01') like 'Segnato. La bozza è già stata fatta%', 'eccezione dopo la bozza');
select verifica((select count(*) from eccezioni_disponibilita) = 1, 'Marta vede la sua eccezione');
select verifica(not disponibile_il(:marta, '2026-11-10') and disponibile_il(:marta, '2026-11-17'), 'martedì 10 no, martedì 17 sì');
select come(:admin);
select verifica((select stale from bozze_turni where id = :'bozza'), 'bozza da rivedere');
select verifica(titoli_avvisi(:admin) like '%| Marta Rossi: disponibilità cambiata dopo la bozza', 'admin avvisato');
select genera_bozza(:scuola, '2026-11-01', '2026-10-29 21:00+01');
select verifica(not (select stale from bozze_turni where id = :'bozza'), 'rigenerata: non più da rivedere');
reset role;
select verifica(not exists (select 1 from turni_volontari tv join turni t on t.id = tv.turno_id where t.giorno = '2026-11-10' and tv.volontario_id = :marta), 'il 10 novembre Marta non è assegnata');

-- ---------------------------------------------------------------------------
\echo '  · anonimo: vede linee e fermate, nient''altro'
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claims', '', false);
select verifica((select count(*) from linee) = 2, 'anon vede le linee');
select verifica((select count(*) from fermate) = 11, 'anon vede le fermate');
select verifica((select count(*) from bambini) = 0, 'anon non vede bambini');
select verifica((select count(*) from persone) = 0, 'anon non vede persone');
select verifica((select count(*) from avvisi) = 0, 'anon non vede avvisi');
select deve_fallire('select chiudi_assenze()', 'anon non lancia i job');
reset role;

-- ---------------------------------------------------------------------------
\echo '  · push e consegna: abbonamenti propri, coda intatta senza pg_net'
-- ---------------------------------------------------------------------------
set role authenticated;
select come(:giulia);
insert into push_abbonamenti (persona_id, endpoint, p256dh, auth, user_agent)
  values (:giulia, 'https://push.example/giulia-1', 'p256dh', 'auth', 'iPhone');
select deve_fallire(format('insert into push_abbonamenti (persona_id, endpoint, p256dh, auth) values (%L, %L, %L, %L)', :marta, 'https://push.example/x', 'k', 'a'), 'Giulia non abbona Marta');
select come(:marta);
select verifica((select count(*) from push_abbonamenti) = 0, 'Marta non vede gli abbonamenti di Giulia');
select deve_fallire('select * from impostazioni', 'nessun utente legge le impostazioni');
select deve_fallire('select avvisi_webhook()', 'il webhook non è chiamabile dall''app');
reset role;
-- Con un URL configurato ma senza pg_net (locale) l'inserimento di un avviso non fallisce.
update impostazioni set valore = 'https://example.invalid/functions/v1/invia-avvisi' where chiave = 'invia_avvisi_url';
select verifica(not avvisi_webhook(), 'senza pg_net il webhook non fa nulla, senza errori');
select avvisa(:giulia, 'info', 'Prova coda', 'Resta in coda finché la funzione non la svuota.');
select verifica((select push_esito is null and tentativi = 0 from avvisi where titolo = 'Prova coda'), 'l''avviso è in coda');
select verifica(not avvisi_ritenta(), 'il ritentativo trova la coda ma, senza pg_net, non può chiamare');
update impostazioni set valore = '' where chiave = 'invia_avvisi_url';
select verifica((select count(*) from avvisi where push_esito is null or (sms and sms_esito is null)) > 0, 'la coda contiene gli avvisi della giornata');

-- ---------------------------------------------------------------------------
\echo '  · dispatcher dei job: una volta al giorno, all''ora giusta'
-- ---------------------------------------------------------------------------
select verifica(esegui_job('2026-10-28 17:55+01') is null, 'alle 17:55 nessun job');
select verifica(esegui_job('2026-10-28 18:02+01') = 'chiudi_assenze', 'alle 18:02 chiude le assenze');
select verifica(esegui_job('2026-10-28 18:07+01') is null, 'non la rifà');
select verifica(esegui_job('2026-10-28 21:03+01') = 'soglia_definitiva', 'alle 21:03 la soglia definitiva');
select verifica((select count(*) from job_eseguiti where giorno = '2026-10-28') = 2, '2 job registrati');

drop function verifica(boolean, text);
drop function deve_fallire(text, text);
drop function titoli_avvisi(uuid);
drop function come(uuid);
