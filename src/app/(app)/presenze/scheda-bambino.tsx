"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/blocchi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn, iniziali } from "@/lib/utils";
import { segnaPresenza } from "@/app/(app)/azioni";

type Props = {
  bambino: { id: string; nome: string; classe: string; femmina: boolean };
  linea: string; fermata: string; orario: string;
  giorno: string; giornoLabel: string;
  assente: boolean; tardiva: boolean;
};

/* La scheda del prototipo: stato e azione affiancati, stessa altezza. */
export function SchedaBambino({ bambino, linea, fermata, orario, giorno, giornoLabel, assente, tardiva }: Props) {
  const [pending, start] = useTransition();
  const lo = bambino.femmina ? "la" : "lo";

  const segna = (stato: "presente" | "assente") =>
    start(async () => {
      const r = await segnaPresenza(bambino.id, stato, giorno);
      toast(r.messaggio);
    });

  return (
    <Card size="sm" className={cn("px-3", assente && "bg-muted")}>
      <div className="flex items-center gap-3">
        <Avatar accent={!assente}>{iniziali(bambino.nome)}</Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold">{bambino.nome}</div>
          <div className="text-[13px] text-muted-foreground">{bambino.classe} · {linea}, {fermata}</div>
        </div>
        {tardiva && <Badge variant="brand">tardiva</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <span className={`inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[13px] font-semibold ${assente ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-success/30 bg-success/10 text-success"}`}>
          {assente ? <><X size={14} strokeWidth={2.5} /> Assente {giornoLabel}</> : <><Check size={14} /> Presente {giornoLabel}</>}
        </span>
        {assente ? (
          <Button variant="outline" size="sm" className="min-h-10 text-[13px]" disabled={pending} onClick={() => segna("presente")}>
            <Check size={14} /> Annulla l&apos;assenza
          </Button>
        ) : (
          <Button variant="destructive" size="sm" className="min-h-10 text-[13px]" disabled={pending} onClick={() => segna("assente")}>
            <X size={14} strokeWidth={2.5} /> Segnala un&apos;assenza
          </Button>
        )}
      </div>
      <span className="text-[13px] text-muted-foreground">
        {assente ? `Non ${lo} aspettano alla fermata.` : `Salvo avviso: ${lo} aspettano alla fermata alle ${orario}.`}
      </span>
    </Card>
  );
}
