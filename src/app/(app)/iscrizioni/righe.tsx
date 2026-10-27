"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import type { StatoApprovazione } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { decidiIscrizione, decidiRuolo } from "@/app/(app)/azioni-admin";

function Decisione({ stato, motivo, onDecidi, pending }: { stato: StatoApprovazione; motivo?: string | null; onDecidi: (s: StatoApprovazione) => void; pending: boolean }) {
  if (stato !== "in_attesa") return <Badge variant={stato === "approvata" ? "success" : "destructive"} title={motivo ?? undefined}>{stato === "approvata" ? "approvata" : "rifiutata"}</Badge>;
  return (
    <>
      <Button variant="outline" size="icon" className="text-destructive" aria-label="Rifiuta" disabled={pending} onClick={() => onDecidi("rifiutata")}><X size={18} strokeWidth={2.5} /></Button>
      <Button variant="outline" size="icon" className="border-success bg-success text-success-foreground" aria-label="Approva" disabled={pending} onClick={() => onDecidi("approvata")}><Check size={18} /></Button>
    </>
  );
}

export function RigaIscrizione({ id, stato, when, genitore, dettaglio, motivo }: { id: string; stato: StatoApprovazione; when: string; genitore: string; dettaglio: string; motivo?: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex min-h-16 items-center gap-3 border-b border-border bg-card px-3 py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{genitore}</div>
        <div className="text-[13px] text-muted-foreground">{dettaglio} · {when}</div>
      </div>
      <Decisione stato={stato} motivo={motivo} pending={pending} onDecidi={(s) => start(async () => {
        const motivo = s === "rifiutata" ? (window.prompt("Motivo del rifiuto (lo legge il genitore):") ?? undefined) : undefined;
        const r = await decidiIscrizione(id, s, motivo); toast(r.messaggio); router.refresh();
      })} />
    </div>
  );
}

export function RigaRuolo({ personaId, scuolaId, nome, when, note }: { personaId: string; scuolaId: string; nome: string; when: string; note: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex min-h-16 items-center gap-3 border-b border-border bg-card px-3 py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{nome} <Badge variant="secondary">volontario</Badge></div>
        <div className="text-[13px] text-muted-foreground">{note ?? "Da verificare nell'albo dei volontari civici"} · {when}</div>
      </div>
      <Decisione stato="in_attesa" pending={pending} onDecidi={(s) => start(async () => {
        const nota = s === "approvata" ? "Albo volontari civici: verificato" : (window.prompt("Motivo (lo legge il volontario):") ?? undefined);
        const r = await decidiRuolo(personaId, scuolaId, "volontario", s, nota); toast(r.messaggio); router.refresh();
      })} />
    </div>
  );
}
