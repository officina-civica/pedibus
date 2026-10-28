-- Cancellazione automatica: si rigioca il tempo sopra i dati del martedì (dopo replay.sql).
-- Anno 2026/27 → fine 30/06/2027; contatti e backup via dal 31/07/2027; storico a 12 mesi.
\set ON_ERROR_STOP on
create or replace function verifica(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if not coalesce(p_ok, false) then raise exception 'VERIFICA FALLITA: %', p_msg; end if;
raise notice '    ✓ %', p_msg; end $$;

-- Date di creazione fisse: il test non deve dipendere dal giorno in cui gira.
update persone set creato_il = '2026-09-01';
update bambini set creato_il = '2026-09-01';
select count(*) as n_bambini from bambini \gset

\echo '  · dentro l''anno non si tocca niente'
select pulizia_dati('2026-10-28 03:00+01');
select verifica((select count(*) from bambini) = :n_bambini, 'tutti i bambini restano');
select verifica((select count(*) from contatti_emergenza) > 0, 'i contatti di emergenza restano');
select verifica((select count(*) from presenze) > 0, 'le presenze restano');

\echo '  · Luca rinnova per il 2027/28, gli altri no'
insert into iscrizioni (bambino_id, linea_id, fermata_id, anno_scolastico, stato, informativa_id)
values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000103', '2027/28', 'in_attesa', 'e0000000-0000-4000-8000-000000000003');

\echo '  · 30 luglio 2027: ancora tutto'
select pulizia_dati('2027-07-30 03:00+02');
select verifica((select count(distinct bambino_id) from contatti_emergenza) > 1, 'fino al 30 luglio i contatti restano');

\echo '  · 31 luglio 2027: via contatti e backup di chi non ha rinnovato'
select pulizia_dati('2027-07-31 03:00+02');
select verifica((select bool_and(bambino_id = 'b0000000-0000-4000-8000-000000000001') from contatti_emergenza), 'restano solo i contatti di Luca');
select verifica((select count(*) from contatti_emergenza) > 0, 'quelli di Luca ci sono');
select verifica((select count(*) from deleghe) = 1, 'la nonna di Luca resta backup');
select verifica((select count(*) from iscrizioni where anno_scolastico = '2026/27' and stato = 'in_attesa') = 0, 'le richieste mai approvate del 2026/27 se ne vanno');
select verifica((select count(*) from bambini) = :n_bambini, 'i bambini restano: servono per ricostruire un incidente');
select verifica((select count(*) from presenze) > 0, 'le presenze restano');
select verifica((select count(*) from appello_bambini) > 0, 'l''appello resta');

select count(*) as n_iscritti from bambini b where exists (select 1 from iscrizioni i where i.bambino_id = b.id and i.stato = 'approvata') \gset

\echo '  · 29 ottobre 2027: lo storico oltre 12 mesi se ne va, i bambini no'
select pulizia_dati('2027-10-29 03:00+02');
select verifica((select count(*) from presenze where giorno < '2026-10-29') = 0, 'presenze di più di 12 mesi fa cancellate');
select verifica((select count(*) from turni where giorno < '2026-10-29') = 0, 'turni (e appelli) di più di 12 mesi fa cancellati');
select verifica((select count(*) from accessi_contatti where consultato_il < '2026-10-29') = 0, 'registro consultazioni oltre 12 mesi cancellato');
select verifica((select count(*) from avvisi where creato_il < '2027-04-29') = 0, 'avvisi oltre 6 mesi cancellati');
select verifica((select count(*) from bambini) = :n_iscritti, 'i bambini iscritti restano fino a 12 mesi dopo la fine dell''anno');
select verifica(:n_iscritti < :n_bambini, 'quelli mai approvati, senza storico, se ne vanno');

\echo '  · 1 luglio 2028: via i bambini del 2026/27 e i profili senza più nulla'
select pulizia_dati('2028-07-01 03:00+02') as esito \gset
select verifica((select count(*) from bambini) = 1, 'resta solo Luca (iscritto 2027/28)');
select verifica(exists (select 1 from persone where id = 'a0000000-0000-4000-8000-000000000001'), 'resta Giulia, la mamma di Luca');
select verifica(exists (select 1 from persone where id = 'a0000000-0000-4000-8000-000000000002'), 'resta la nonna, backup di Luca');
select verifica(exists (select 1 from persone where id = 'a0000000-0000-4000-8000-000000000009'), 'resta l''amministratore');
select verifica((select count(*) from persone) = 3, 'gli altri profili sono cancellati');
select verifica((select count(*) from auth.users u where not exists (select 1 from persone p where p.id = u.id)) = 0, 'con il profilo se ne va anche l''utente di accesso');
select verifica((:'esito'::jsonb->>'profili_rimandati')::int = 0, 'nessun profilo rimandato');

\echo '  · nel dispatcher: alle 3 di notte, una volta'
select verifica(esegui_job('2028-07-02 03:05+02') = 'pulizia_dati', 'alle 3:05 parte la pulizia');
select verifica(esegui_job('2028-07-02 03:10+02') is null, 'non la rifà');
select verifica((select esito like 'ok {%' from job_eseguiti where nome = 'pulizia_dati' and giorno = '2028-07-02'), 'l''esito riporta i conteggi');

drop function verifica(boolean, text);
