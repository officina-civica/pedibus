"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, MapPin, Phone, Plus, School, TriangleAlert, Users } from "lucide-react";
import type { AppelloStato, ContattoTurno, TurnoDettaglio } from "@/lib/database.types";
import { hhmm } from "@/lib/date";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Avatar, H2 } from "@/components/blocchi";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { iniziali } from "@/lib/utils";
import { apriAppello, segnaSalito, aggiungiAllAppello, prossimaFermata, consegnaAScuola, contattiEmergenza } from "@/app/(app)/azioni-volontario";

export function ApriAppello({ turnoId, capolinea, sonoDiTurno }: { turnoId: string; capolinea: string; sonoDiTurno: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);
  if (!sonoDiTurno) return <p className="text-[13px] text-muted-foreground">L&apos;appello lo apre chi è di turno.</p>;
  return (
    <>
      <Button size="lg" disabled={pending} onClick={() => start(async () => { const r = await apriAppello(turnoId); if (!r.ok) setErrore(r.messaggio); router.refresh(); })} className="w-full">
        <MapPin size={18} /> Apri l&apos;appello a {capolinea}
      </Button>
      {errore && <p className="text-[13px] text-destructive">{errore}</p>}
    </>
  );
}

/* Fermata per fermata: spunte grandi, "prossima fermata", bambino non in lista, consegna. */
export function AppelloInCorso({ turno: t, stato: a }: { turno: TurnoDettaglio; stato: AppelloStato }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [aggiungo, setAggiungo] = useState(false);
  const [contatti, setContatti] = useState<ContattoTurno[] | null>(null);

  const esegui = (fn: () => Promise<{ ok: boolean; messaggio: string }>) =>
    start(async () => { const r = await fn(); if (r.messaggio && (!r.ok || r.messaggio !== "Fatto.")) toast(r.messaggio); router.refresh(); });

  const f = a.fermata_corrente;
  const arrivo = !!f?.arrivo;
  const aBordo = a.bambini.filter((b) => b.stato === "salito" || b.stato === "aggiunto");
  const attesiQui = a.bambini.filter((b) => b.fermata_id === f?.id && b.stato !== "aggiunto");
  const altri = (t.volontari.filter((v) => !v.sono_io && v.stato !== "non_viene" && (v.ruolo === "titolare" || v.stato === "copre")).map((v) => v.nome.split(" ")[0]).join(" e ")) || "nessun altro";

  if (a.consegnato_il) {
    const nonTrovati = a.bambini.filter((b) => b.stato === "non_trovato");
    return (
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col items-center gap-3.5 pt-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"><School size={30} /></span>
          <h1 className="text-[22px] font-bold tracking-tight">Consegnati a scuola</h1>
          <p className="text-sm text-muted-foreground">Alle {hhmm(new Date(a.consegnato_il).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }))} · {aBordo.length} bambini. I genitori hanno ricevuto la notifica. Da qui la responsabilità passa alla scuola.</p>
        </div>
        {nonTrovati.length > 0 && (
          <Alert variant="warning"><TriangleAlert /><AlertTitle>Non trovati alla fermata</AlertTitle><AlertDescription>{nonTrovati.map((b) => b.nome).join(", ")}. Genitori avvisati.</AlertDescription></Alert>
        )}
        <p className="text-center text-[13px] text-muted-foreground">Grazie. Il prossimo turno lo trovi in Turni.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ background: t.linea.colore }} /><span className="text-[17px] font-semibold">{t.linea.nome}</span></div>
        <Button variant="outline" size="icon" aria-label="Contatti d'emergenza" disabled={pending} onClick={() => start(async () => { const r = await contattiEmergenza(t.id); if (!r.ok) toast(r.messaggio); else setContatti(contatti ? null : r.contatti); })}>
          <Phone size={20} />
        </Button>
      </div>

      {contatti && (
        <Card size="sm" className="px-3">
          <H2>Contatti d&apos;emergenza · consultazione registrata</H2>
          {contatti.length === 0 ? <p className="text-[13px] text-muted-foreground">Nessun contatto registrato per i bambini attesi.</p> : (
            <div className="flex flex-col gap-1.5 text-sm">
              {contatti.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2"><span>{c.bambino} · {c.nome} ({c.relazione})</span><a className="tabular-nums font-semibold" href={`tel:${c.telefono.replace(/\s/g, "")}`}>{c.telefono}</a></div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setContatti(null)}>Chiudi</Button>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between"><H2>{arrivo ? "Arrivo" : `Fermata ${f?.ordine} di ${a.fermate}`}</H2><span className="tabular-nums text-[13px] text-muted-foreground">{arrivo ? `${aBordo.length} a bordo` : `${attesiQui.filter((b) => b.stato === "salito").length} di ${attesiQui.length} presenti`}</span></div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${a.fermate + 1}, minmax(0,1fr))` }}>
          {Array.from({ length: a.fermate + 1 }).map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full ${i + 1 < (f?.ordine ?? 1) ? "bg-primary" : i + 1 === (f?.ordine ?? 1) ? "bg-brand" : "bg-border"}`} />
          ))}
        </div>
        <div className="flex items-center gap-2">{arrivo ? <School size={18} /> : <MapPin size={18} />}<span className="text-lg font-bold">{f?.nome}</span><span className="tabular-nums text-[13px] text-muted-foreground">{f ? hhmm(f.orario) : ""}</span></div>
      </div>

      {arrivo ? (
        <div className="flex flex-col overflow-hidden rounded-xl border border-border">
          {aBordo.map((b) => (
            <div key={b.id} className="flex min-h-13 items-center gap-3 border-b border-border px-3 last:border-b-0"><Avatar size="sm">{iniziali(b.nome)}</Avatar><span className="flex-1 font-semibold">{b.nome}</span><span className="text-[13px] text-muted-foreground">{b.classe}</span></div>
          ))}
        </div>
      ) : attesiQui.length ? (
        <div className="flex flex-col overflow-hidden rounded-xl border border-border">
          {attesiQui.map((b) => {
            const salito = b.stato === "salito";
            return (
              <button key={b.id} type="button" disabled={pending} onClick={() => esegui(() => segnaSalito(a.id, b.id, !salito))}
                className={`flex min-h-16 w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 ${salito ? "bg-card" : "bg-muted"}`}>
                <Avatar>{iniziali(b.nome)}</Avatar>
                <span className="flex-1">
                  <span className="block text-[17px] font-semibold">{b.nome}</span>
                  <span className="text-[13px] text-muted-foreground">{b.classe}{b.tardiva ? " · modifica tardiva" : ""}{b.stato === "non_trovato" ? " · non trovato" : ""}</span>
                </span>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ${salito ? "border-success bg-success text-success-foreground" : "border-border text-transparent"}`}><Check size={22} strokeWidth={3} /></span>
              </button>
            );
          })}
        </div>
      ) : (
        <Card size="sm" className="px-3"><p className="text-[13px] text-muted-foreground">Nessun bambino atteso a questa fermata.</p></Card>
      )}

      {!arrivo && (
        <Button variant="outline" onClick={() => setAggiungo(!aggiungo)} className="w-full border-dashed"><Plus size={16} /> {aggiungo ? "Chiudi" : "Non è in lista? Aggiungi un bambino iscritto"}</Button>
      )}
      {aggiungo && !arrivo && (
        <>
          <div className="flex flex-col overflow-hidden rounded-xl border border-border">
            {a.aggiungibili.length ? a.aggiungibili.map((b) => (
              <button key={b.id} type="button" disabled={pending} onClick={() => { setAggiungo(false); esegui(() => aggiungiAllAppello(a.id, b.id)); }}
                className="flex min-h-14 w-full items-center gap-3 border-b border-border bg-card px-3 text-left last:border-b-0">
                <Avatar size="sm">{iniziali(b.nome)}</Avatar><span className="flex-1"><span className="font-semibold">{b.nome}</span> <span className="text-[13px] text-muted-foreground">{b.classe} · segnato assente</span></span><Plus size={18} />
              </button>
            )) : <div className="px-3 py-3 text-[13px] text-muted-foreground">Tutti gli iscritti della linea sono già in lista. Un bambino non iscritto non si prende.</div>}
          </div>
          <p className="text-[13px] leading-[1.5] text-muted-foreground">Solo bambini con iscrizione approvata. Chi non è iscritto non viene preso: il volontario non può assumersi quella responsabilità.</p>
        </>
      )}

      <Alert><Users /><AlertDescription><b>{aBordo.length} a bordo</b> · con {altri}{a.kit_presente ? " · kit presente" : " · nessun kit"}</AlertDescription></Alert>

      <div className="sticky bottom-[72px] -mx-4 border-t border-border bg-card px-4 pt-2.5 pb-3.5">
        {arrivo ? (
          <Button size="lg" disabled={pending} onClick={() => esegui(() => consegnaAScuola(a.id))} className="w-full"><School size={20} /> Consegnati a scuola</Button>
        ) : (
          <Button size="lg" disabled={pending} onClick={() => esegui(() => prossimaFermata(a.id))} className="w-full">Prossima fermata <ChevronRight size={20} strokeWidth={2.5} /></Button>
        )}
      </div>
    </div>
  );
}
