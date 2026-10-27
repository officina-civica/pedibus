"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { impostaCanale } from "@/app/(app)/azioni-admin";
import type { CanaleChiave, Canali as TCanali } from "@/lib/database.types";

/* Gli interruttori dei canali: cambiano come partono gli avvisi senza toccare il codice. */
export function Canali({ canali }: { canali: TCanali }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const cambia = (chiave: CanaleChiave, valore: boolean) => start(async () => {
    const r = await impostaCanale(chiave, valore);
    setToast(r.messaggio);
    router.refresh();
  });

  return (
    <Card>
      <p className="text-[13px] leading-[1.5] text-muted">Le notifiche push sono sempre attive. Gli SMS servono al codice di accesso; per gli avvisi si accendono da qui, quando il comitato decide (hanno un costo e portano fuori dall&apos;app nome e fermata dei bambini).</p>
      <Interruttore id="sms_avvisi" etichetta="SMS per gli avvisi urgenti" dettaglio="Linea annullata, turno scoperto: oltre alla push parte un SMS." attivo={canali.sms_avvisi} disabled={pending} onChange={(v) => cambia("sms_avvisi", v)} />
      <Interruttore id="sms_ripiego" etichetta="SMS a chi non ha le push" dettaglio="Anche gli avvisi normali, solo a chi non ha attivato le notifiche." attivo={canali.sms_ripiego} disabled={pending || !canali.sms_avvisi} onChange={(v) => cambia("sms_ripiego", v)} />
      {toast && <Toast messaggio={toast} onDone={() => setToast(null)} />}
    </Card>
  );
}

function Interruttore({ id, etichetta, dettaglio, attivo, disabled, onChange }: { id: string; etichetta: string; dettaglio: string; attivo: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className={`flex items-center justify-between gap-3 ${disabled ? "opacity-60" : ""}`}>
      <span className="flex min-w-0 items-start gap-2">
        <MessageSquare size={16} className="mt-0.5 shrink-0" />
        <span className="min-w-0"><span className="block text-sm font-semibold">{etichetta}</span><span className="block text-[13px] leading-[1.4] text-muted">{dettaglio}</span></span>
      </span>
      <button id={id} type="button" role="switch" aria-checked={attivo} disabled={disabled} onClick={() => onChange(!attivo)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${attivo ? "bg-primary" : "bg-muted-bg"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow transition-transform ${attivo ? "left-1 translate-x-5" : "left-1"}`} />
      </button>
    </label>
  );
}
