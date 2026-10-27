-- Avvio del database di produzione: i dati di base senza i quali l'app non ha nulla da mostrare.
-- Si esegue UNA volta, dall'editor SQL della dashboard, dopo `supabase db push`.
-- Prima di lanciarlo: sostituire le linee e le fermate con quelle vere, e il telefono dell'amministratore.
-- Idempotente: rilanciarlo non duplica nulla (chiavi fisse e `on conflict do nothing`).

begin;

-- Comune e scuola -------------------------------------------------------------------------------
insert into comuni (id, nome) values ('e0000000-0000-4000-8000-000000000002', 'Vedano al Lambro')
on conflict (id) do nothing;
insert into scuole (id, comune_id, nome) values ('e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'Scuola primaria')
on conflict (id) do nothing;

-- Informativa privacy in vigore (url: il link al documento del comitato, se c'è) ---------------
insert into informative (id, versione, url, valida_dal) values ('e0000000-0000-4000-8000-000000000003', '1.0', null, current_date)
on conflict (id) do nothing;

-- Linee e fermate ---------------------------------------------------------------------------------
-- DA SOSTITUIRE con le linee vere del pedibus di Vedano. Per ogni linea: nome, colore, minimo volontari,
-- soglia bambini sotto la quale si annulla, ora di partenza. Per ogni fermata: ordine, nome, orario;
-- la prima è il capolinea, l'ultima è l'arrivo (la scuola) e non si può scegliere come salita.
insert into linee (id, scuola_id, nome, colore, min_volontari, soglia_bambini, ora_partenza) values
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Linea Verde', '#15803d', 2, 4, '07:30'),
  ('c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Linea Blu',   '#1d4ed8', 2, 4, '07:35')
on conflict (id) do nothing;

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
  ('d0000000-0000-4000-8000-000000000205', 'c0000000-0000-4000-8000-000000000002', 5, 'Scuola primaria',    '08:00', false, true)
on conflict (id) do nothing;

-- Primo amministratore ---------------------------------------------------------------------------
-- La persona esiste già: è entrata con il codice SMS (e si è registrata). Il telefono è quello del login,
-- senza il "+" (così lo salva Supabase Auth). Gli altri admin li nomina lei dall'app.
insert into ruoli (persona_id, scuola_id, ruolo, stato, note, deciso_il)
select p.id, 'e0000000-0000-4000-8000-000000000001', 'admin', 'approvata', 'Primo amministratore (avvio)', now()
from persone p
where p.telefono in ('<<TELEFONO_ADMIN>>', '+<<TELEFONO_ADMIN>>')
on conflict (persona_id, scuola_id, ruolo) do update set stato = 'approvata', deciso_il = excluded.deciso_il;

-- Controllo: deve restituire 1 riga per l'admin e il conteggio di linee e fermate.
select (select count(*) from ruoli where ruolo = 'admin' and stato = 'approvata') as admin,
       (select count(*) from linee) as linee,
       (select count(*) from fermate) as fermate,
       (select count(*) from informative) as informative;

commit;
