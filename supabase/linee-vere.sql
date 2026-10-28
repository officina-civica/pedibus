-- Linee vere del pedibus (28/10/2026), da lanciare UNA volta nell'editor SQL della dashboard Supabase.
-- - Linea Blu: la linea di prova diventa quella vera (stesse chiavi: fermate aggiornate sul posto).
-- - Linea Verde (di prova): sospesa, senza avvisi (non ha iscritti veri); i turni futuri si annullano.
-- - Informativa privacy 1.0: link alla pagina dell'app.
-- Idempotente: rilanciarlo lascia tutto com'è.

begin;

update linee set ora_partenza = '07:55', ora_arrivo = '08:15', colore = '#1d4ed8'
where id = 'c0000000-0000-4000-8000-000000000002';

update fermate f set nome = v.nome, orario = v.orario::time, capolinea = v.capolinea, arrivo = v.arrivo
from (values
  ('d0000000-0000-4000-8000-000000000201'::uuid, 1, 'Acqua e Sapone',                  '07:55', true,  false),
  ('d0000000-0000-4000-8000-000000000202'::uuid, 2, 'Parchetto via Matteotti',         '08:00', false, false),
  ('d0000000-0000-4000-8000-000000000203'::uuid, 3, 'Area verde via Grandi/via Gramsci','08:05', false, false),
  ('d0000000-0000-4000-8000-000000000204'::uuid, 4, 'Rotonda Iperal',                  '08:10', false, false),
  ('d0000000-0000-4000-8000-000000000205'::uuid, 5, 'Via Italia (scuola)',             '08:15', false, true)
) as v(id, ordine, nome, orario, capolinea, arrivo)
where f.id = v.id and f.ordine = v.ordine;

update linee set attiva = false where id = 'c0000000-0000-4000-8000-000000000001';
update turni set stato = 'annullato_definitivo', motivo = 'Linea sospesa', aggiornato_il = now()
where linea_id = 'c0000000-0000-4000-8000-000000000001'
  and giorno >= (now() at time zone 'Europe/Rome')::date
  and stato in ('programmato', 'riattivato', 'annullato_soglia');

update informative set url = 'https://pedibus.officinacivica.com/informativa'
where versione = '1.0';

-- Controllo
select l.nome, l.attiva, l.ora_partenza, l.ora_arrivo, f.ordine, f.nome as fermata, f.orario
from linee l join fermate f on f.linea_id = l.id
order by l.nome, f.ordine;

commit;
