-- Il backup del genitore si indica dall'app, per numero di telefono: la persona deve essere già
-- entrata almeno una volta (esiste in persone). Un genitore può delegare chi vuole; il delegato
-- può solo segnare presenze e assenze dei suoi bambini (RLS su deleghe e miei_bambini()).
create or replace function aggiungi_delega(p_telefono text, p_etichetta text default null, p_at timestamptz default now()) returns text
language plpgsql security definer set search_path = public as $$
declare tel text; d uuid;
begin
  if auth.uid() is null then raise exception 'Devi essere autenticato' using errcode = '42501'; end if;
  tel := regexp_replace(p_telefono, '[^0-9+]', '', 'g');
  if tel ~ '^3\d{8,9}$' then tel := '+39' || tel; end if;
  if tel ~ '^0039' then tel := '+' || substr(tel, 3); end if;
  select p.id into d from persone p where regexp_replace(coalesce(p.telefono, ''), '[^0-9+]', '', 'g') = tel limit 1;
  if d is null then
    return 'Nessuno con questo numero è ancora entrato nell''app: chiedigli di entrare una volta, poi riprova.';
  end if;
  if d = auth.uid() then return 'Non puoi delegare te stesso.'; end if;
  insert into deleghe (genitore_id, delegato_id, etichetta, creata_il) values (auth.uid(), d, nullif(trim(p_etichetta), ''), p_at)
  on conflict (genitore_id, delegato_id) do update set etichetta = excluded.etichetta;
  perform avvisa(d, 'info', 'Sei il backup per le presenze',
    format('%s ti ha indicato come backup: puoi segnare presenze e assenze dei suoi bambini, nient''altro.',
           (select p.nome || ' ' || p.cognome from persone p where p.id = auth.uid())), false, null, null, p_at);
  return 'Backup aggiunto.';
end $$;
revoke execute on function aggiungi_delega(text, text, timestamptz) from anon;
