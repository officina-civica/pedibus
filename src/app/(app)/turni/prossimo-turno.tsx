"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, BriefcaseMedical, TriangleAlert, Users } from "lucide-react";
import type { TurnoDettaglio } from "@/lib/database.types";
import { turnoParte, ETICHETTA_TURNO } from "@/lib/turni";
import { giornoLungo, hhmm, oggiRome, quando } from "@/lib/date";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Avatar, H2 } from "@/components/blocchi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { iniziali } from "@/lib/utils";
import { nonPossoVenire, coproTurno } from "@/app/(app)/azioni-volontario";

/* La scheda del prossimo turno: chi c'è, se è coperto, cosa posso fare. */
export function ProssimoTurno({ t }: { t: TurnoDettaglio }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [backup, setBackup] = useState(false);
  const io = t.volontari.find((v) => v.sono_io);
  const hoAvvisato = io?.stato === "non_viene";
  // Titolare (o riserva che già copre): posso dire che non vengo. Backup libero o estraneo: posso coprire.
  const sonoDentro = !!io && (io.ruolo === "titolare" || io.stato === "copre") && io.stato !== "non_viene";
  const possoCoprire = (!io || (io.ruolo === "backup" && io.stato === "assegnato")) || hoAvvisato;
  const parte = turnoParte(t.stato);
  const coperto = t.copertura >= t.linea.min_volontari;
  const mancanti = t.volontari.filter((v) => v.stato === "non_viene").map((v) => v.nome);
  const oggi = t.giorno === oggiRome();
  const finito = t.stato === "consegnato";

  const esegui = (fn: () => Promise<{ ok: boolean; messaggio: string }>) =>
    start(async () => { const r = await fn(); toast(r.messaggio); router.refresh(); });

  return (
    <Card size="sm" className="border-l-4 border-l-brand px-3">
      <H2 className="text-brand">Prossimo turno</H2>
      <div>
        <div className="text-lg font-semibold">{oggi ? "Oggi" : giornoLungo(t.giorno)} · {hhmm(t.linea.ora_partenza)}</div>
        <div className="text-[13px] text-muted-foreground">{t.linea.nome} · capolinea {t.capolinea} · {t.attesi} bambini attesi</div>
      </div>
      {!parte && <Badge variant="destructive">{ETICHETTA_TURNO[t.stato]}{t.motivo ? ` · ${t.motivo}` : ""}</Badge>}
      {finito && <Badge variant="success">consegnata a scuola</Badge>}

      <div className="flex flex-col gap-2">
        {t.volontari.filter((v) => v.ruolo === "titolare" || v.stato === "copre").map((v) => (
          <div key={v.id} className="flex items-center gap-2">
            <Avatar size="sm">{iniziali(v.nome)}</Avatar>
            <span className={v.stato === "non_viene" ? "text-muted-foreground line-through" : ""}>{v.nome}{v.sono_io ? " (tu)" : ""}</span>
            {v.kit && v.stato !== "non_viene" && <Badge variant="success"><BriefcaseMedical size={12} /> kit</Badge>}
            {v.stato === "non_viene" && <Badge variant="destructive">non viene</Badge>}
            {v.stato === "copre" && <Badge variant="brand">riserva</Badge>}
          </div>
        ))}
      </div>

      {t.escalation_dal && !coperto && parte && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>{`Turno scoperto: ${t.copertura} su ${t.linea.min_volontari}`}</AlertTitle>
          <AlertDescription>
            {mancanti.join(" e ")} non {mancanti.length > 1 ? "possono" : "può"} venire (dalle {quando(t.escalation_dal)}). Avvisati i backup del giorno
            {t.escalation_allargata_il ? "; avviso andato a tutti i volontari." : "; dopo 10 minuti l'avviso va a tutti i volontari, poi al gestore turni."}
          </AlertDescription>
        </Alert>
      )}
      {mancanti.length > 0 && coperto && parte && (
        <Alert variant="success">
          <Check />
          <AlertTitle>Turno coperto</AlertTitle>
          <AlertDescription>
            {mancanti.join(" e ")} non {mancanti.length > 1 ? "vengono" : "viene"}: {t.volontari.filter((v) => v.stato === "copre").map((v) => v.nome).join(", ") || "il team"} copre. {t.copertura} volontari su {t.linea.min_volontari}{t.kit_presente ? ", kit presente" : ", nessun kit"}.
          </AlertDescription>
        </Alert>
      )}
      {!t.kit_presente && parte && !finito && t.volontari.length > 0 && !mancanti.length && (
        <Alert variant="warning"><BriefcaseMedical /><AlertTitle>Nessun kit di primo soccorso nel turno</AlertTitle><AlertDescription>Chi ha il kit lo porti, o avvisa l&apos;amministratore.</AlertDescription></Alert>
      )}

      {/* I pulsanti vanno a capo quando lo schermo è stretto, invece di uscire dalla scheda. */}
      <div className="flex flex-wrap gap-2">
        {sonoDentro && (
          <Button variant="destructive" className="min-w-[9.5rem] flex-1" disabled={pending || hoAvvisato || finito || !parte} onClick={() => esegui(() => nonPossoVenire(t.id))}>
            {hoAvvisato ? "Hai avvisato" : "Non posso venire"}
          </Button>
        )}
        {possoCoprire && parte && !finito && !coperto && (
          <Button className="min-w-[9.5rem] flex-1" disabled={pending} onClick={() => esegui(() => coproTurno(t.id))}>Copro io il turno</Button>
        )}
        <Button variant="outline" className="min-w-[9.5rem] flex-1" onClick={() => setBackup(!backup)}><Users size={16} /> Chi è di backup</Button>
      </div>

      {backup && (
        <div className="flex flex-col overflow-hidden rounded-xl border border-border">
          {[...t.volontari.filter((v) => v.ruolo === "backup"), ...t.backup_disponibili.map((b) => ({ ...b, ruolo: "disponibile" as const, stato: "assegnato" as const, sono_io: false }))].length === 0 ? (
            <div className="px-3 py-3 text-[13px] text-muted-foreground">Nessun backup disponibile per questo giorno.</div>
          ) : (
            <>
              {t.volontari.filter((v) => v.ruolo === "backup").map((v) => (
                <div key={v.id} className="flex min-h-14 items-center gap-3 border-b border-border px-3 last:border-b-0">
                  <Avatar size="sm">{iniziali(v.nome)}</Avatar>
                  <div className="flex-1"><div className="font-semibold">{v.nome}</div><div className="text-[13px] text-muted-foreground">backup del giorno{v.kit ? " · ha il kit" : ""}</div></div>
                  {v.stato === "copre" && <Badge variant="brand">copre il turno</Badge>}
                </div>
              ))}
              {t.backup_disponibili.map((b) => (
                <div key={b.id} className="flex min-h-14 items-center gap-3 border-b border-border px-3 last:border-b-0">
                  <Avatar size="sm">{iniziali(b.nome)}</Avatar>
                  <div className="flex-1"><div className="font-semibold">{b.nome}</div><div className="text-[13px] text-muted-foreground">disponibile quel giorno{b.kit ? " · ha il kit" : ""}</div></div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
