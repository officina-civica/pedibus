-- =============================================================================
-- Canali di notifica: due interruttori in impostazioni, modificabili dall'admin
-- dall'app (Profilo → Canali di notifica), senza toccare il codice.
--   sms_avvisi   true → gli avvisi urgenti (avvisi.sms) partono anche via SMS
--   sms_ripiego  true → chi non ha le push riceve via SMS anche gli avvisi normali
-- Deciso il 27/10: per ora entrambi spenti, gli SMS servono solo all'OTP di accesso
-- (negli SMS passerebbero in chiaro, a un fornitore terzo, nome e fermata di un minore).
-- La Edge Function invia-avvisi e i testi dell'app leggono questi valori.
-- =============================================================================
insert into impostazioni (chiave, valore, note) values
  ('sms_avvisi', 'false', 'Se true, gli avvisi urgenti (avvisi.sms) partono anche via SMS. Interruttore in Profilo per l''admin.')
on conflict (chiave) do nothing;
update impostazioni set valore = 'false' where chiave = 'sms_ripiego';
update impostazioni set note = 'Se true, chi non ha attivato le push riceve via SMS anche gli avvisi normali. Ha effetto solo con sms_avvisi = true.' where chiave = 'sms_ripiego';

-- Gli interruttori, leggibili da chiunque sia entrato (i segreti restano nascosti).
create or replace function canali() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'sms_avvisi',  coalesce((select valore = 'true' from impostazioni where chiave = 'sms_avvisi'), false),
    'sms_ripiego', coalesce((select valore = 'true' from impostazioni where chiave = 'sms_ripiego'), false));
$$;
revoke all on function canali() from public;
grant execute on function canali() to authenticated;

-- Solo l'admin, e solo questi due interruttori.
create or replace function imposta_canale(p_chiave text, p_valore boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo l''amministratore può cambiare i canali di notifica.'; end if;
  if p_chiave not in ('sms_avvisi', 'sms_ripiego') then raise exception 'Interruttore sconosciuto: %', p_chiave; end if;
  insert into impostazioni (chiave, valore) values (p_chiave, case when p_valore then 'true' else 'false' end)
  on conflict (chiave) do update set valore = excluded.valore;
  return canali();
end $$;
revoke all on function imposta_canale(text, boolean) from public;
grant execute on function imposta_canale(text, boolean) to authenticated;

-- Il testo per i volontari non deve promettere un canale che potrebbe essere spento.
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
          'Turno sotto il minimo un''ora prima della partenza. Famiglie avvisate.', true, null, p_at);
        perform avvisa_admin(s.id, 'warn', format('%s annullata: volontari insufficienti', tr.linea_nome),
          format('%s su %s. Famiglie avvisate alle %s.', n, tr.min_volontari, ora_hhmm(p_at)), true, tr.linea_id, tr.id, p_at);
      end if;
    end loop;
  end loop;
end $$;
