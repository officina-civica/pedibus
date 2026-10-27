"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { impostaCanale } from "@/app/(app)/azioni-admin";
import type { CanaleChiave, Canali as TCanali } from "@/lib/database.types";

/* Gli interruttori dei canali: cambiano come partono gli avvisi senza toccare il codice. */
export function Canali({ canali }: { canali: TCanali }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const cambia = (chiave: CanaleChiave, valore: boolean) => start(async () => {
    const r = await impostaCanale(chiave, valore);
    toast(r.messaggio);
    router.refresh();
  });

  return (
    <Card size="sm" className="px-3">
      <p className="text-[13px] leading-[1.5] text-muted-foreground">Le notifiche push sono sempre attive. Gli SMS servono al codice di accesso; per gli avvisi si accendono da qui, quando il comitato decide (hanno un costo e portano fuori dall&apos;app nome e fermata dei bambini).</p>
      <Interruttore id="sms_avvisi" etichetta="SMS per gli avvisi urgenti" dettaglio="Linea annullata, turno scoperto: oltre alla push parte un SMS." attivo={canali.sms_avvisi} disabled={pending} onChange={(v) => cambia("sms_avvisi", v)} />
      <Interruttore id="sms_ripiego" etichetta="SMS a chi non ha le push" dettaglio="Anche gli avvisi normali, solo a chi non ha attivato le notifiche." attivo={canali.sms_ripiego} disabled={pending || !canali.sms_avvisi} onChange={(v) => cambia("sms_ripiego", v)} />
    </Card>
  );
}

function Interruttore({ id, etichetta, dettaglio, attivo, disabled, onChange }: { id: string; etichetta: string; dettaglio: string; attivo: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${disabled ? "opacity-60" : ""}`}>
      <Label htmlFor={id} className="flex min-w-0 items-start gap-2 font-normal">
        <MessageSquare size={16} className="mt-0.5 shrink-0" />
        <span className="min-w-0"><span className="block text-sm font-semibold">{etichetta}</span><span className="block text-[13px] leading-[1.4] text-muted-foreground">{dettaglio}</span></span>
      </Label>
      <Switch id={id} checked={attivo} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
