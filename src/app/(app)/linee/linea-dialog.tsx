"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Linea } from "@/lib/database.types";
import { salvaLinea, type DatiLinea } from "@/app/(app)/azioni-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const COLORI = ["#15803d", "#1d4ed8", "#b91c1c", "#ca8a04", "#7e22ce", "#c2410c", "#0f766e", "#db2777"];
const hm = (t: string) => t.slice(0, 5);

/* Nuova linea o modifica: nome, colore, orari, soglie. Le fermate si gestiscono nella scheda. */
export function LineaDialog({ scuolaId, linea, open, onOpenChange }: { scuolaId: string; linea?: Linea; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);
  const [d, setD] = useState<DatiLinea>(() => ({
    nome: linea?.nome ?? "", colore: linea?.colore ?? COLORI[0],
    oraPartenza: hm(linea?.ora_partenza ?? "07:30"), oraArrivo: hm(linea?.ora_arrivo ?? "08:00"),
    sogliaBambini: linea?.soglia_bambini ?? 4, minVolontari: linea?.min_volontari ?? 2, volontariConsigliati: linea?.volontari_consigliati ?? 3,
    oraChiusuraAssenze: hm(linea?.ora_chiusura_assenze ?? "18:00"), oraSogliaDefinitiva: hm(linea?.ora_soglia_definitiva ?? "21:00"),
  }));
  const set = <K extends keyof DatiLinea>(k: K, v: DatiLinea[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (v: string, min: number) => Math.max(min, parseInt(v || "0", 10) || min);

  const salva = () => {
    setErrore(null);
    if (!d.nome.trim()) { setErrore("Serve il nome della linea."); return; }
    start(async () => {
      const r = await salvaLinea(scuolaId, d, linea?.id);
      if (!r.ok) { setErrore(r.messaggio); return; }
      toast(r.messaggio); onOpenChange(false); router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{linea ? `Modifica ${linea.nome}` : "Nuova linea"}</DialogTitle>
          <DialogDescription>{linea ? "Orari di capolinea e arrivo seguono quelli della linea." : "La linea nasce con capolinea e arrivo: le fermate in mezzo le aggiungi dopo."}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); salva(); }}>
          <Field>
            <FieldLabel htmlFor="l-nome">Nome</FieldLabel>
            <Input id="l-nome" value={d.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Linea Verde" required autoFocus={!linea} />
          </Field>
          <Field>
            <FieldLabel>Colore</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {COLORI.map((c) => (
                <button key={c} type="button" aria-label={`Colore ${c}`} aria-pressed={d.colore === c} onClick={() => set("colore", c)}
                  className={cn("h-8 w-8 rounded-full ring-offset-2 ring-offset-popover transition-shadow", d.colore === c && "ring-2 ring-foreground")} style={{ background: c }} />
              ))}
              <label className="ml-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <input type="color" aria-label="Altro colore" value={d.colore} onChange={(e) => set("colore", e.target.value)} className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0" />
                altro
              </label>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field><FieldLabel htmlFor="l-partenza">Partenza</FieldLabel><Input id="l-partenza" type="time" value={d.oraPartenza} onChange={(e) => set("oraPartenza", e.target.value)} required /></Field>
            <Field><FieldLabel htmlFor="l-arrivo">Arrivo a scuola</FieldLabel><Input id="l-arrivo" type="time" value={d.oraArrivo} onChange={(e) => set("oraArrivo", e.target.value)} required /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field><FieldLabel htmlFor="l-soglia">Soglia bimbi</FieldLabel><Input id="l-soglia" type="number" inputMode="numeric" min={1} value={d.sogliaBambini} onChange={(e) => set("sogliaBambini", num(e.target.value, 1))} /></Field>
            <Field><FieldLabel htmlFor="l-min">Volontari min.</FieldLabel><Input id="l-min" type="number" inputMode="numeric" min={1} value={d.minVolontari} onChange={(e) => set("minVolontari", num(e.target.value, 1))} /></Field>
            <Field><FieldLabel htmlFor="l-cons">Consigliati</FieldLabel><Input id="l-cons" type="number" inputMode="numeric" min={1} value={d.volontariConsigliati} onChange={(e) => set("volontariConsigliati", num(e.target.value, 1))} /></Field>
          </div>
          <FieldDescription>Sotto la soglia di bambini presenti la linea si annulla la sera prima; sotto il minimo di volontari un&apos;ora prima della partenza.</FieldDescription>
          <div className="grid grid-cols-2 gap-3">
            <Field><FieldLabel htmlFor="l-chiusura">Chiusura assenze</FieldLabel><Input id="l-chiusura" type="time" value={d.oraChiusuraAssenze} onChange={(e) => set("oraChiusuraAssenze", e.target.value)} required /></Field>
            <Field><FieldLabel htmlFor="l-definitiva">Soglia definitiva</FieldLabel><Input id="l-definitiva" type="time" value={d.oraSogliaDefinitiva} onChange={(e) => set("oraSogliaDefinitiva", e.target.value)} required /></Field>
          </div>
          <FieldDescription>Orari della sera prima: dopo la chiusura le assenze sono tardive; alla soglia definitiva la decisione è presa.</FieldDescription>
          {errore && <Alert variant="destructive"><AlertDescription>{errore}</AlertDescription></Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvo…" : linea ? "Salva" : "Crea la linea"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
