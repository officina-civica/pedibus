"use client";

import { useEffect, useState, useTransition } from "react";
import { Fingerprint, KeyRound } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Pk = { id: string; friendly_name?: string | null; created_at?: string };

/* La passkey: dopo il primo accesso col codice, da qui si attiva lo sblocco del telefono. */
export function Passkey() {
  const [supportata, setSupportata] = useState(false);
  const [lista, setLista] = useState<Pk[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const carica = async () => {
    try {
      const { data } = await supabaseBrowser().auth.passkey.list();
      setLista(((data as unknown as { passkeys?: Pk[] } | null)?.passkeys ?? (Array.isArray(data) ? (data as Pk[]) : [])) as Pk[]);
    } catch { setLista([]); }
  };

  useEffect(() => {
    const t = setTimeout(() => { setSupportata("PublicKeyCredential" in window); carica(); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registra = () => start(async () => {
    setErrore(null);
    try {
      const nome = /iPhone|iPad/.test(navigator.userAgent) ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "Questo dispositivo";
      const { error } = await supabaseBrowser().auth.registerPasskey({ friendlyName: nome } as never);
      if (error) { setErrore(error.message); return; }
      await carica();
    } catch (e) {
      setErrore(e instanceof Error && /abort|cancel|NotAllowed/i.test(e.message) ? null : (e instanceof Error ? e.message : "Registrazione non riuscita."));
    }
  });

  const rimuovi = (id: string) => start(async () => {
    try { await supabaseBrowser().auth.passkey.delete({ id } as never); await carica(); } catch (e) { setErrore(e instanceof Error ? e.message : "Errore"); }
  });

  return (
    <Card>
      <div className="flex items-center justify-between gap-2.5">
        <span className="flex items-center gap-2"><Fingerprint size={16} /> Passkey (sblocco del telefono)</span>
        <Badge tone={lista?.length ? "ok" : "muted"}>{lista === null ? "…" : lista.length ? `${lista.length} attiv${lista.length === 1 ? "a" : "e"}` : "non attiva"}</Badge>
      </div>
      {!supportata ? (
        <p className="text-[13px] leading-[1.5] text-muted">Questo browser non supporta le passkey: continui a entrare con il codice via SMS.</p>
      ) : (
        <>
          <p className="text-[13px] leading-[1.5] text-muted">Con la passkey entri con impronta o Face ID, senza aspettare l&apos;SMS. Il codice resta sempre disponibile come riserva.</p>
          {(lista ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2"><KeyRound size={14} /> {p.friendly_name || "Passkey"}</span>
              <button type="button" className="text-[13px] text-muted underline" disabled={pending} onClick={() => rimuovi(p.id)}>rimuovi</button>
            </div>
          ))}
          <Button variant={lista?.length ? "outline" : "primary"} block disabled={pending} onClick={registra}>
            <Fingerprint size={18} /> {lista?.length ? "Aggiungi una passkey su questo dispositivo" : "Attiva la passkey"}
          </Button>
        </>
      )}
      {errore && <p className="text-[13px] text-danger">{errore}</p>}
    </Card>
  );
}
