"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Avatar, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { iniziali } from "@/lib/utils";
import { aggiungiDelega, rimuoviDelega } from "@/app/(app)/azioni";

type Delegato = { id: string; nome: string; telefono: string | null; etichetta: string | null };

/* Il backup presenze: chi può segnare presenze e assenze al posto mio, nient'altro. */
export function Backup({ delegati }: { delegati: Delegato[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [apri, setApri] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [etichetta, setEtichetta] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  return (
    <Card>
      {delegati.length === 0 && <p className="text-[13px] leading-[1.5] text-muted">Nessun backup indicato. L&apos;altro genitore, un nonno, chiunque tu scelga: può solo segnare presenze e assenze dei tuoi bambini. Deve essere entrato nell&apos;app almeno una volta.</p>}
      {delegati.map((d) => (
        <div key={d.id} className="flex items-center gap-3">
          <Avatar>{iniziali(d.nome)}</Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">{d.nome}{d.etichetta ? ` (${d.etichetta})` : ""}</div>
            <div className="text-[13px] text-muted">{d.telefono ? `${d.telefono} · ` : ""}può solo segnare presenze e assenze</div>
          </div>
          <button type="button" aria-label={`Rimuovi ${d.nome}`} className="text-muted" disabled={pending} onClick={() => start(async () => { await rimuoviDelega(d.id); router.refresh(); })}><Trash2 size={16} /></button>
        </div>
      ))}
      {apri ? (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await aggiungiDelega(telefono, etichetta); setToast(r.messaggio); if (r.ok) { setApri(false); setTelefono(""); setEtichetta(""); } router.refresh(); }); }}>
          <Input type="tel" placeholder="Cellulare del backup, es. 338 765 4321" value={telefono} onChange={(e) => setTelefono(e.target.value)} required />
          <Input placeholder="Chi è (es. nonna Rita)" value={etichetta} onChange={(e) => setEtichetta(e.target.value)} />
          <div className="flex gap-2"><Button type="button" className="flex-1" onClick={() => setApri(false)}>Annulla</Button><Button type="submit" variant="primary" className="flex-1" disabled={pending}>Aggiungi</Button></div>
        </form>
      ) : (
        <Button variant="dashed" block onClick={() => setApri(true)}><Plus size={16} /> Aggiungi un backup</Button>
      )}
      {toast && <Toast messaggio={toast} onDone={() => setToast(null)} />}
    </Card>
  );
}
