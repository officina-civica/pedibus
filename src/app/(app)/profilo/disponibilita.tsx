"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TipoEccezione } from "@/lib/database.types";
import { H2 } from "@/components/blocchi";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { impostaDisponibilita, segnaEccezione } from "@/app/(app)/azioni-volontario";

const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven"];

type Props = {
  giorni: number[];                                  // settimana tipo, 0 = lunedì
  eccezioni: { giorno: string; tipo: TipoEccezione }[];
  mese: string;                                      // primo giorno del mese delle eccezioni, YYYY-MM-DD
  chiusure: string[];                                // giorni senza scuola
  bozzaFatta: boolean;
};

/* Settimana tipo + calendario del mese prossimo per le eccezioni, come nel prototipo. */
export function Disponibilita({ giorni, eccezioni, mese, chiusure, bozzaFatta }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sett, setSett] = useState<number[]>(giorni);

  const toggleGiorno = (i: number) => {
    const next = sett.includes(i) ? sett.filter((x) => x !== i) : [...sett, i].sort();
    setSett(next);
    start(async () => { const r = await impostaDisponibilita(next); if (!r.ok) toast(r.messaggio); router.refresh(); });
  };

  const giorniMese = (() => {
    const out: { iso: string; d: number; wd: number }[] = [];
    const base = new Date(mese + "T12:00:00");
    for (let d = new Date(base); d.getMonth() === base.getMonth(); d.setDate(d.getDate() + 1)) {
      const wd = (d.getDay() + 6) % 7;
      if (wd < 5) out.push({ iso: d.toISOString().slice(0, 10), d: d.getDate(), wd });
    }
    return out;
  })();
  const primoWd = giorniMese[0]?.wd ?? 0;
  const nomeMese = new Date(mese + "T12:00:00").toLocaleDateString("it-IT", { month: "long" });

  const toggleEccezione = (iso: string, wd: number) => {
    const e = eccezioni.find((x) => x.giorno === iso);
    const dflt = sett.includes(wd);
    const tipo: TipoEccezione | null = e ? null : dflt ? "assente" : "presente";
    start(async () => { const r = await segnaEccezione(iso, tipo); toast(r.messaggio); router.refresh(); });
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <H2>Disponibilità settimanale</H2>
        <p className="text-[13px] leading-[1.5] text-muted-foreground">Vale ogni settimana. Nei giorni disponibili in cui non sei di turno fai da riserva.</p>
        <div className="grid grid-cols-5 gap-1.5">
          {GIORNI.map((g, i) => {
            const on = sett.includes(i);
            return (
              <button key={g} type="button" aria-pressed={on} disabled={pending} onClick={() => toggleGiorno(i)}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[10px] border ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                <small className={`text-[11px] uppercase ${on ? "opacity-75" : "text-muted-foreground"}`}>{g}</small><b className="text-sm">{on ? "sì" : "no"}</b>
              </button>
            );
          })}
        </div>
      </div>

      <div id="eccezioni" className="flex flex-col gap-2">
        <div className="flex items-center justify-between"><H2>Eccezioni di {nomeMese}</H2>{eccezioni.length > 0 && <Badge variant="brand">{eccezioni.length} {eccezioni.length > 1 ? "giorni" : "giorno"}</Badge>}</div>
        <p className="text-[13px] leading-[1.5] text-muted-foreground">
          Un giorno diverso dal solito: tocca per dire «non ci sono» dove saresti disponibile, o «ci sono» dove di solito no.{" "}
          {bozzaFatta ? "La bozza è già stata fatta: ogni modifica avvisa l'amministratore." : "Prima della bozza del mese: ne tiene conto."}
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {GIORNI.map((g) => <small key={g} className="text-center text-[11px] uppercase text-muted-foreground">{g}</small>)}
          {Array.from({ length: primoWd }).map((_, i) => <span key={"v" + i} />)}
          {giorniMese.map(({ iso, d, wd }) => {
            const chiuso = chiusure.includes(iso);
            const e = eccezioni.find((x) => x.giorno === iso)?.tipo;
            const dflt = sett.includes(wd);
            const cls = chiuso ? "border-dashed border-border bg-muted text-muted-foreground opacity-50"
              : e === "assente" ? "border-destructive/30 bg-destructive/10 text-destructive"
              : e === "presente" ? "border-success/30 bg-success/10 text-success"
              : dflt ? "border-border bg-card" : "border-dashed border-border bg-muted text-muted-foreground";
            return (
              <button key={iso} type="button" disabled={pending || chiuso} aria-pressed={!!e} onClick={() => toggleEccezione(iso, wd)}
                className={`flex min-h-12 flex-col items-center justify-center gap-px rounded-[10px] border px-0.5 py-1 ${cls}`}>
                <b className={`text-sm ${e === "assente" ? "line-through" : ""}`}>{d}</b>
                <small className={`text-center text-[10px] uppercase leading-[1.1] ${e ? "font-bold" : "text-muted-foreground"}`}>{chiuso ? "no scuola" : e === "assente" ? "non ci sono" : e === "presente" ? "ci sono" : dflt ? "sì" : "no"}</small>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
