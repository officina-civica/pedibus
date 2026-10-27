"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, TriangleAlert } from "lucide-react";
import type { BozzaTurni } from "@/lib/database.types";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { generaBozza, inviaBozza, pubblicaBozza } from "@/app/(app)/azioni-admin";

export function BozzaMese({ bozza, scuolaId, meseIso, eccezioni }: { bozza: BozzaTurni | null; scuolaId: string; meseIso: string; eccezioni: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const esegui = (fn: () => Promise<{ ok: boolean; messaggio: string }>) =>
    start(async () => { const r = await fn(); setToast(r.messaggio); router.refresh(); });
  const perQuestoMese = bozza && bozza.mese.slice(0, 7) === meseIso.slice(0, 7) ? bozza : null;
  const mese = new Date(meseIso + "T12:00:00").toLocaleDateString("it-IT", { month: "long" });

  return (
    <>
      {perQuestoMese?.stale && (
        <Alert tone="warn" icon={<TriangleAlert size={16} />} title="Disponibilità cambiate dopo la bozza">
          Un volontario ha segnato un&apos;eccezione dopo la generazione: la bozza {perQuestoMese.stato === "inviata" ? "già inviata" : "attuale"} non ne tiene conto.
          <div className="mt-1.5"><Button size="sm" disabled={pending} onClick={() => esegui(() => generaBozza(scuolaId, meseIso))}><RotateCcw size={14} /> Rigenera la bozza</Button></div>
        </Alert>
      )}
      {!perQuestoMese ? (
        <Card>
          <p className="text-[13px] leading-[1.5] text-muted">L&apos;algoritmo genera la bozza di {mese} da disponibilità settimanali, eccezioni per data ({eccezioni} segnate), backup e kit: minimo volontari e un kit per turno dove possibile, mai più di due turni a settimana a testa.</p>
          <Button variant="primary" block disabled={pending} onClick={() => esegui(() => generaBozza(scuolaId, meseIso))}>Genera la bozza di {mese}</Button>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between gap-2.5">
            <b>Bozza di {mese}</b>
            <Badge tone={perQuestoMese.stato === "pubblicata" ? "ok" : perQuestoMese.stato === "inviata" ? "ok" : "accent"}>{perQuestoMese.stato === "bozza" ? "da rivedere" : perQuestoMese.stato}</Badge>
          </div>
          <p className="text-[13px] leading-[1.5] text-muted">
            {perQuestoMese.stato === "bozza" && "Generata: controlla i turni scoperti e i giorni senza kit, poi invia ai volontari."}
            {perQuestoMese.stato === "inviata" && `Inviata ai volontari: chi non risponde entro il ${perQuestoMese.scadenza_silenzio_assenso ? new Date(perQuestoMese.scadenza_silenzio_assenso + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "la scadenza"} conferma per silenzio-assenso.`}
            {perQuestoMese.stato === "pubblicata" && "Pubblicata: i turni sono definitivi, le modifiche si fanno turno per turno."}
          </p>
          <div className="flex gap-2">
            {perQuestoMese.stato === "bozza" && <>
              <Button className="flex-1" disabled={pending} onClick={() => esegui(() => generaBozza(scuolaId, meseIso))}><RotateCcw size={14} /> Rigenera</Button>
              <Button variant="primary" className="flex-1" disabled={pending} onClick={() => esegui(() => inviaBozza(perQuestoMese.id))}>Invia per conferma</Button>
            </>}
            {perQuestoMese.stato === "inviata" && <Button variant="primary" block disabled={pending} onClick={() => esegui(() => pubblicaBozza(perQuestoMese.id))}>Pubblica i turni</Button>}
          </div>
        </Card>
      )}
      {toast && <Toast messaggio={toast} onDone={() => setToast(null)} />}
    </>
  );
}
