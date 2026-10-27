-- Trovato dal giro end-to-end: un genitore deve vedere nome e telefono del proprio delegato,
-- e il delegato quelli del genitore che lo ha delegato. La policy su persone non lo permetteva.
drop policy persone_lettura on persone;
create policy persone_lettura on persone for select to authenticated
  using (
    id = auth.uid()
    or is_admin()
    or exists (select 1 from ruoli r where r.persona_id = persone.id and r.ruolo = 'volontario' and r.stato = 'approvata'
               and r.scuola_id in (select mie_scuole_volontario()))
    or exists (select 1 from deleghe d where (d.genitore_id = auth.uid() and d.delegato_id = persone.id)
                                          or (d.delegato_id = auth.uid() and d.genitore_id = persone.id))
  );
