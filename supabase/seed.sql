-- =============================================================================
-- Pedibus · seed di sviluppo: il "martedì a Vedano" del prototipo.
-- Gli id sono fissi e leggibili, così i test (tests/replay.sql) li citano per nome:
--   persone  a0000000-0000-4000-8000-0000000000NN
--   bambini  b0000000-0000-4000-8000-0000000000NN
--   linee    c0000000-…01 (Verde) / …02 (Blu)
--   fermate  d0000000-…L0 + ordine  (L = 1 Verde, 2 Blu)
--   scuola   e0000000-…01 · comune e0000000-…02 · informativa e0000000-…03
--   turni    f0000000-…01 (Verde 27/10) / …02 (Blu 27/10)
-- Vale per lo sviluppo (supabase db reset). Sul progetto vero gli utenti nascono dall'Auth.
-- =============================================================================

-- Utenti (il trigger crea le righe in persone)
insert into auth.users (id, email, phone, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'giulia.bianchi@esempio.it',  '+393331234567', '{"nome":"Giulia","cognome":"Bianchi"}'),
  ('a0000000-0000-4000-8000-000000000002', 'rita.bianchi@esempio.it',    '+393387654321', '{"nome":"Rita","cognome":"Bianchi"}'),
  ('a0000000-0000-4000-8000-000000000003', 'marta.rossi@esempio.it',     '+393472223344', '{"nome":"Marta","cognome":"Rossi"}'),
  ('a0000000-0000-4000-8000-000000000004', 'paolo.verdi@esempio.it',     null, '{"nome":"Paolo","cognome":"Verdi"}'),
  ('a0000000-0000-4000-8000-000000000005', 'anna.ferrari@esempio.it',    null, '{"nome":"Anna","cognome":"Ferrari"}'),
  ('a0000000-0000-4000-8000-000000000006', 'giorgio.sala@esempio.it',    null, '{"nome":"Giorgio","cognome":"Sala"}'),
  ('a0000000-0000-4000-8000-000000000007', 'elena.riva@esempio.it',      null, '{"nome":"Elena","cognome":"Riva"}'),
  ('a0000000-0000-4000-8000-000000000008', 'carlo.fumagalli@esempio.it', null, '{"nome":"Carlo","cognome":"Fumagalli"}'),
  ('a0000000-0000-4000-8000-000000000009', 'admin@officinacivica.it',    null, '{"nome":"Officina","cognome":"Civica"}'),
  -- altri genitori
  ('a0000000-0000-4000-8000-000000000010', 'rossi@esempio.it',    null, '{"nome":"Andrea","cognome":"Rossi"}'),
  ('a0000000-0000-4000-8000-000000000011', 'colombo@esempio.it',  null, '{"nome":"Laura","cognome":"Colombo"}'),
  ('a0000000-0000-4000-8000-000000000012', 'ferrari@esempio.it',  null, '{"nome":"Marco","cognome":"Ferrari"}'),
  ('a0000000-0000-4000-8000-000000000013', 'moretti@esempio.it',  null, '{"nome":"Sara","cognome":"Moretti"}'),
  ('a0000000-0000-4000-8000-000000000014', 'greco@esempio.it',    null, '{"nome":"Paola","cognome":"Greco"}'),
  ('a0000000-0000-4000-8000-000000000015', 'russo@esempio.it',    null, '{"nome":"Luca","cognome":"Russo"}'),
  ('a0000000-0000-4000-8000-000000000016', 'gallo@esempio.it',    null, '{"nome":"Elisa","cognome":"Gallo"}'),
  ('a0000000-0000-4000-8000-000000000017', 'conti@esempio.it',    null, '{"nome":"Davide","cognome":"Conti"}'),
  ('a0000000-0000-4000-8000-000000000018', 'ricci@esempio.it',    null, '{"nome":"Anna","cognome":"Ricci"}'),
  ('a0000000-0000-4000-8000-000000000019', 'colombo2@esempio.it', null, '{"nome":"Stefano","cognome":"Colombo"}'),
  ('a0000000-0000-4000-8000-000000000020', 'marini@esempio.it',   null, '{"nome":"Chiara","cognome":"Marini"}'),
  ('a0000000-0000-4000-8000-000000000021', 'fontana@esempio.it',  null, '{"nome":"Roberto","cognome":"Fontana"}'),
  ('a0000000-0000-4000-8000-000000000022', 'romano@esempio.it',   null, '{"nome":"Valentina","cognome":"Romano"}'),
  ('a0000000-0000-4000-8000-000000000023', 'barbieri@esempio.it', null, '{"nome":"Matteo","cognome":"Barbieri"}'),
  ('a0000000-0000-4000-8000-000000000024', 'villa@esempio.it',    null, '{"nome":"Federica","cognome":"Villa"}'),
  -- iscrizioni in attesa
  ('a0000000-0000-4000-8000-000000000025', 'ahmed.karimi@esempio.it',    null, '{"nome":"Ahmed","cognome":"Karimi"}'),
  ('a0000000-0000-4000-8000-000000000026', 'francesca.pozzi@esempio.it', null, '{"nome":"Francesca","cognome":"Pozzi"}'),
  ('a0000000-0000-4000-8000-000000000027', 'marco.colombo@esempio.it',   null, '{"nome":"Marco","cognome":"Colombo"}');

-- Territorio
insert into comuni (id, nome) values ('e0000000-0000-4000-8000-000000000002', 'Vedano al Lambro');
insert into scuole (id, comune_id, nome) values ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'Scuola primaria');
insert into informative (id, versione, valida_dal) values ('e0000000-0000-4000-8000-000000000003', '1.0', '2026-09-15');
insert into calendario_chiusure (scuola_id, giorno, motivo) values
  ('e0000000-0000-4000-8000-000000000001', '2026-12-07', 'Ponte di Sant''Ambrogio'),
  ('e0000000-0000-4000-8000-000000000001', '2026-12-08', 'Immacolata');

insert into linee (id, scuola_id, nome, colore, min_volontari, soglia_bambini, ora_partenza) values
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Linea Verde', '#15803d', 2, 4, '07:30'),
  ('c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Linea Blu',   '#1d4ed8', 2, 4, '07:35');

insert into fermate (id, linea_id, ordine, nome, orario, capolinea, arrivo) values
  ('d0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000001', 1, 'Piazza Repubblica',  '07:30', true,  false),
  ('d0000000-0000-4000-8000-000000000102', 'c0000000-0000-4000-8000-000000000001', 2, 'Via Manzoni, 12',    '07:36', false, false),
  ('d0000000-0000-4000-8000-000000000103', 'c0000000-0000-4000-8000-000000000001', 3, 'Via Roma, farmacia', '07:42', false, false),
  ('d0000000-0000-4000-8000-000000000104', 'c0000000-0000-4000-8000-000000000001', 4, 'Via Verdi, parco',   '07:48', false, false),
  ('d0000000-0000-4000-8000-000000000105', 'c0000000-0000-4000-8000-000000000001', 5, 'Via Dante, chiesa',  '07:53', false, false),
  ('d0000000-0000-4000-8000-000000000106', 'c0000000-0000-4000-8000-000000000001', 6, 'Scuola primaria',    '08:00', false, true),
  ('d0000000-0000-4000-8000-000000000201', 'c0000000-0000-4000-8000-000000000002', 1, 'Via Battisti',       '07:35', true,  false),
  ('d0000000-0000-4000-8000-000000000202', 'c0000000-0000-4000-8000-000000000002', 2, 'Via Verdi, 40',      '07:41', false, false),
  ('d0000000-0000-4000-8000-000000000203', 'c0000000-0000-4000-8000-000000000002', 3, 'Via Garibaldi, bar', '07:47', false, false),
  ('d0000000-0000-4000-8000-000000000204', 'c0000000-0000-4000-8000-000000000002', 4, 'Via Cavour',         '07:53', false, false),
  ('d0000000-0000-4000-8000-000000000205', 'c0000000-0000-4000-8000-000000000002', 5, 'Scuola primaria',    '08:00', false, true);

-- Ruoli
insert into ruoli (persona_id, scuola_id, ruolo, stato, deciso_il) values
  ('a0000000-0000-4000-8000-000000000009', 'e0000000-0000-4000-8000-000000000001', 'admin', 'approvata', '2026-09-01');
insert into ruoli (persona_id, scuola_id, ruolo, stato, note, deciso_da, deciso_il)
select ('a0000000-0000-4000-8000-0000000000' || n)::uuid, 'e0000000-0000-4000-8000-000000000001', 'volontario', 'approvata',
       'Albo volontari civici: verificato', 'a0000000-0000-4000-8000-000000000009', '2026-09-10'
from unnest(array['03','04','05','06','07','08']) n;
insert into ruoli (persona_id, scuola_id, ruolo, stato, deciso_da, deciso_il)
select ('a0000000-0000-4000-8000-0000000000' || n)::uuid, 'e0000000-0000-4000-8000-000000000001', 'genitore', 'approvata',
       'a0000000-0000-4000-8000-000000000009', '2026-09-20'
from unnest(array['01','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24']) n;
-- Marco Colombo chiede di fare il volontario: da verificare nell'albo
insert into ruoli (persona_id, scuola_id, ruolo, stato, richiesto_il) values
  ('a0000000-0000-4000-8000-000000000027', 'e0000000-0000-4000-8000-000000000001', 'volontario', 'in_attesa', '2026-10-25 10:00+02');

-- Bambini (genere solo per gli accordi nei testi)
insert into bambini (id, scuola_id, genitore_id, nome, cognome, classe, genere, pettorina) values
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Luca',     'Bianchi',  '2ª B', 'M', '7'),
  ('b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Sofia',    'Bianchi',  '4ª A', 'F', '8'),
  ('b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000010', 'Matteo',   'Rossi',    '1ª A', 'M', null),
  ('b0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'Emma',     'Colombo',  '3ª C', 'F', null),
  ('b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'Giacomo',  'Ferrari',  '5ª A', 'M', null),
  ('b0000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000013', 'Aurora',   'Moretti',  '2ª A', 'F', null),
  ('b0000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000014', 'Leonardo', 'Greco',    '1ª B', 'M', null),
  ('b0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000015', 'Chiara',   'Russo',    '4ª B', 'F', null),
  ('b0000000-0000-4000-8000-000000000009', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000016', 'Tommaso',  'Gallo',    '3ª A', 'M', null),
  ('b0000000-0000-4000-8000-000000000010', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000017', 'Alice',    'Conti',    '5ª B', 'F', null),
  ('b0000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000018', 'Davide',   'Ricci',    '2ª B', 'M', null),
  ('b0000000-0000-4000-8000-000000000012', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000019', 'Sara',     'Colombo',  '1ª A', 'F', null),
  ('b0000000-0000-4000-8000-000000000013', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000020', 'Nicolò',   'Marini',   '3ª B', 'M', null),
  ('b0000000-0000-4000-8000-000000000014', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000021', 'Giulia',   'Fontana',  '2ª C', 'F', null),
  ('b0000000-0000-4000-8000-000000000015', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000022', 'Pietro',   'Romano',   '4ª A', 'M', null),
  ('b0000000-0000-4000-8000-000000000016', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000023', 'Elisa',    'Barbieri', '5ª C', 'F', null),
  ('b0000000-0000-4000-8000-000000000017', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000024', 'Marco',    'Villa',    '1ª C', 'M', null),
  -- in attesa di approvazione
  ('b0000000-0000-4000-8000-000000000018', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000025', 'Yasmin',   'Karimi',   '2ª A', 'F', null),
  ('b0000000-0000-4000-8000-000000000019', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000026', 'Pietro',   'Pozzi',    '1ª B', 'M', null),
  ('b0000000-0000-4000-8000-000000000020', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000026', 'Anna',     'Pozzi',    '4ª C', 'F', null);

-- Iscrizioni approvate: (bambino, linea, fermata-ordine). Luca sulla Verde, Sofia sulla Blu.
insert into iscrizioni (bambino_id, linea_id, fermata_id, anno_scolastico, stato, informativa_id, consenso_il, richiesta_il, decisa_da, decisa_il)
select ('b0000000-0000-4000-8000-0000000000' || b)::uuid,
       ('c0000000-0000-4000-8000-00000000000' || l)::uuid,
       ('d0000000-0000-4000-8000-000000000' || l || '0' || f)::uuid,
       '2026/27', 'approvata', 'e0000000-0000-4000-8000-000000000003', '2026-09-18', '2026-09-18',
       'a0000000-0000-4000-8000-000000000009', '2026-09-20'
from (values
  ('01','1','3'), ('02','2','3'), ('03','1','2'), ('04','1','1'), ('05','1','1'), ('06','1','4'), ('07','1','4'),
  ('08','1','5'), ('09','1','2'), ('10','1','5'), ('11','1','3'),
  ('12','2','2'), ('13','2','1'), ('14','2','3'), ('15','2','4'), ('16','2','2'), ('17','2','3')
) v(b, l, f);
-- In attesa
insert into iscrizioni (bambino_id, linea_id, fermata_id, anno_scolastico, stato, informativa_id, consenso_il, richiesta_il) values
  ('b0000000-0000-4000-8000-000000000018', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000202', '2026/27', 'in_attesa', 'e0000000-0000-4000-8000-000000000003', '2026-10-26 12:05+01', '2026-10-26 12:05+01'),
  ('b0000000-0000-4000-8000-000000000019', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000104', '2026/27', 'in_attesa', 'e0000000-0000-4000-8000-000000000003', '2026-10-26 09:30+01', '2026-10-26 09:30+01'),
  ('b0000000-0000-4000-8000-000000000020', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000104', '2026/27', 'in_attesa', 'e0000000-0000-4000-8000-000000000003', '2026-10-26 09:30+01', '2026-10-26 09:30+01');

-- Nonna Rita può segnare presenze e assenze per Giulia
insert into deleghe (genitore_id, delegato_id, etichetta) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'nonna Rita');

-- Contatti d'emergenza dei Bianchi
insert into contatti_emergenza (bambino_id, nome, relazione, telefono, ordine) values
  ('b0000000-0000-4000-8000-000000000001', 'Giulia Bianchi', 'mamma', '+39 333 123 4567', 1),
  ('b0000000-0000-4000-8000-000000000001', 'Andrea Bianchi', 'papà',  '+39 335 987 6543', 2),
  ('b0000000-0000-4000-8000-000000000002', 'Giulia Bianchi', 'mamma', '+39 333 123 4567', 1),
  ('b0000000-0000-4000-8000-000000000002', 'Andrea Bianchi', 'papà',  '+39 335 987 6543', 2);

-- Disponibilità (0 = lunedì … 4 = venerdì)
insert into disponibilita (volontario_id, giorno)
select ('a0000000-0000-4000-8000-0000000000' || v)::uuid, g
from (values ('03', array[1,2,4]), ('04', array[1,3]), ('05', array[1,2]), ('06', array[1,4]), ('07', array[1,3]), ('08', array[0,1])) d(v, gg),
     unnest(d.gg) g;

-- Dotazioni
insert into dotazioni (volontario_id, tipo, numero, consegnata_il) values
  ('a0000000-0000-4000-8000-000000000003', 'kit', null, '2026-09-15'),
  ('a0000000-0000-4000-8000-000000000003', 'pettorina', '12', '2026-09-15'),
  ('a0000000-0000-4000-8000-000000000005', 'kit', null, '2026-09-15'),
  ('a0000000-0000-4000-8000-000000000006', 'kit', null, '2026-09-15'),
  ('a0000000-0000-4000-8000-000000000008', 'kit', null, '2026-09-15');

-- Turni di martedì 27 ottobre
insert into turni (id, linea_id, giorno) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '2026-10-27'),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', '2026-10-27');
insert into turni_volontari (turno_id, volontario_id, ruolo) values
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'titolare'),  -- Marta (kit)
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'titolare'),  -- Paolo
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'backup'),    -- Anna (kit)
  ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000006', 'titolare'),  -- Giorgio (kit)
  ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000007', 'titolare'),  -- Elena
  ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000008', 'backup');    -- Carlo (kit)

-- Assenze già segnate lunedì pomeriggio (non tardive): Davide sulla Verde; Sara, Elisa, Marco sulla Blu.
-- Sofia la segna Giulia alle 17:30: è il primo passo della storia (tests/replay.sql).
insert into presenze (bambino_id, giorno, stato, tardiva, segnata_da, segnata_il) values
  ('b0000000-0000-4000-8000-000000000011', '2026-10-27', 'assente', false, 'a0000000-0000-4000-8000-000000000018', '2026-10-26 15:10+01'),
  ('b0000000-0000-4000-8000-000000000012', '2026-10-27', 'assente', false, 'a0000000-0000-4000-8000-000000000019', '2026-10-26 16:20+01'),
  ('b0000000-0000-4000-8000-000000000016', '2026-10-27', 'assente', false, 'a0000000-0000-4000-8000-000000000023', '2026-10-26 16:45+01'),
  ('b0000000-0000-4000-8000-000000000017', '2026-10-27', 'assente', false, 'a0000000-0000-4000-8000-000000000024', '2026-10-26 17:05+01');
