-- =============================================================================
-- Pedibus · letture di comodo per l'app
-- Il genitore vede della linea solo i conteggi, non i nomi: contare i presenti richiede
-- di leggere iscrizioni e presenze di tutti, cosa che la sua RLS non permette.
-- Queste funzioni (security definer) restituiscono esattamente ciò che la schermata mostra.
-- =============================================================================

-- Lo stato delle linee su cui ho bambini, per il giorno di riferimento.
create or replace function stato_mie_linee(p_giorno date default null)
returns table (
  linea_id uuid, nome text, colore text, soglia_bambini int, ora_partenza time,
  ora_chiusura_assenze time, ora_soglia_definitiva time, giorno date,
  stato stato_turno, presenti int, consegnato_alle time
)
language plpgsql stable security definer set search_path = public as $$
declare s uuid; g date;
begin
  if auth.uid() is null then return; end if;
  select b.scuola_id into s from bambini b where b.id in (select miei_bambini()) limit 1;
  if s is null then return; end if;
  g := coalesce(p_giorno, giorno_riferimento(s));
  return query
    select l.id, l.nome, l.colore, l.soglia_bambini, l.ora_partenza, l.ora_chiusura_assenze, l.ora_soglia_definitiva, g,
           coalesce(t.stato, 'programmato'::stato_turno), presenti_attesi(l.id, g),
           (select locale(a.consegnato_il)::time from appelli a where a.turno_id = t.id and a.consegnato_il is not null)
    from linee l
    left join turni t on t.linea_id = l.id and t.giorno = g
    where l.id in (select mie_linee())
    order by l.ora_partenza, l.nome;
end $$;
revoke execute on function stato_mie_linee(date) from anon;

-- Il giorno di riferimento della mia scuola (genitore o volontario), per non doverlo calcolare nell'app.
create or replace function mio_giorno_riferimento()
returns date
language sql stable security definer set search_path = public as $$
  select giorno_riferimento(coalesce(
    (select b.scuola_id from bambini b where b.id in (select miei_bambini()) limit 1),
    (select r.scuola_id from ruoli r where r.persona_id = auth.uid() and r.stato = 'approvata' limit 1)))
$$;
revoke execute on function mio_giorno_riferimento() from anon;
