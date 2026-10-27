"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import type { StatoApprovazione } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { decidiIscrizione, decidiRuolo } from "@/app/(app)/azioni-admin";

function Decisione({ stato, motivo, onDecidi, pending }: { stato: StatoApprovazione; motivo?: string | null; onDecidi: (s: StatoApprovazione) => void; pending: boolean }) {
  if (stato !== "in_attesa") return <Badge tone={stato === "approvata" ? "ok" : "danger"} title={motivo ?? undefined}>{stato === "approvata" ? "approvata" : "rifiutata"}</Badge>;
  return (
    <>
      <Button size="icon" className="text-danger" aria-label="Rifiuta" disabled={pending} onClick={() => onDecidi("rifiutata")}><X size={18} strokeWidth={2.5} /></Button>
      <Button size="icon" className="border-ok bg-ok text-white" aria-label="Approva" disabled={pending} onClick={() => onDecidi("approvata")}><Check size={18} /></Button>
    </>
  );
}

export function RigaIscrizione({ id, stato, when, genitore, dettaglio, motivo }: { id: string; stato: StatoApprovazione; when: string; genitore: string; dettaglio: string; motivo?: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  return (
    <div className="flex min-h-16 items-center gap-3 border-b border-border bg-card px-3 py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{genitore}</div>
        <div className="text-[13px] text-muted">{dettaglio} · {when}</div>
      </div>
      <Decisione stato={stato} motivo={motivo} pending={pending} onDecidi={(s) => start(async () => {
        const motivo = s === "rifiutata" ? (window.prompt("Motivo del rifiuto (lo legge il genitore):") ?? undefined) : undefined;
        const r = await decidiIscrizione(id, s, motivo); setToast(r.messaggio); router.refresh();
      })} />
      {toast && <Toast messaggio={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

export function RigaRuolo({ personaId, scuolaId, nome, when, note }: { personaId: string; scuolaId: string; nome: string; when: string; note: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  return (
    <div className="flex min-h-16 items-center gap-3 border-b border-border bg-card px-3 py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{nome} <Badge tone="muted">volontario</Badge></div>
        <div className="text-[13px] text-muted">{note ?? "Da verificare nell'albo dei volontari civici"} · {when}</div>
      </div>
      <Decisione stato="in_attesa" pending={pending} onDecidi={(s) => start(async () => {
        const nota = s === "approvata" ? "Albo volontari civici: verificato" : (window.prompt("Motivo (lo legge il volontario):") ?? undefined);
        const r = await decidiRuolo(personaId, scuolaId, "volontario", s, nota); setToast(r.messaggio); router.refresh();
      })} />
      {toast && <Toast messaggio={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
