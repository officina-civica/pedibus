"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { eliminaChiusura, salvaChiusura } from "@/app/(app)/azioni-admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Chiusura = { giorno: string; motivo: string };

/* I giorni senza pedibus: vacanze, ponti, chiusure della scuola. Non si generano né turni né appelli. */
export function Chiusure({ scuolaId, chiusure }: { scuolaId: string; chiusure: Chiusura[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [aperto, setAperto] = useState(false);
  const [giorno, setGiorno] = useState("");
  const [motivo, setMotivo] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const esegui = (fn: () => Promise<{ ok: boolean; messaggio: string }>) => start(async () => { const r = await fn(); toast(r.messaggio); router.refresh(); });

  const salva = () => {
    setErrore(null);
    if (!giorno) { setErrore("Scegli il giorno."); return; }
    start(async () => {
      const r = await salvaChiusura(scuolaId, giorno, motivo);
      if (!r.ok) { setErrore(r.messaggio); return; }
      toast(r.messaggio); setAperto(false); setGiorno(""); setMotivo(""); router.refresh();
    });
  };

  return (
    <Card size="sm" className="px-3">
      {chiusure.length === 0 ? <p className="text-[13px] text-muted-foreground">Nessuna chiusura in calendario.</p> : chiusure.map((c) => (
        <div key={c.giorno} className="flex items-center gap-2 text-sm">
          <span className="flex-1">{new Date(c.giorno + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "long" })}</span>
          <span className="text-muted-foreground">{c.motivo}</span>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Togli ${c.giorno}`} disabled={pending} onClick={() => esegui(() => eliminaChiusura(scuolaId, c.giorno))}><Trash2 /></Button>
        </div>
      ))}
      <p className="text-[13px] text-muted-foreground">Nei giorni in calendario non si generano né turni né appelli.</p>
      <Button variant="outline" size="sm" className="self-start border-dashed" onClick={() => setAperto(true)}><Plus /> Aggiungi un giorno</Button>

      <Dialog open={aperto} onOpenChange={setAperto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Giorno senza pedibus</DialogTitle>
            <DialogDescription>Un ponte, una vacanza, una chiusura della scuola.</DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); salva(); }}>
            <Field><FieldLabel htmlFor="c-giorno">Giorno</FieldLabel><Input id="c-giorno" type="date" value={giorno} onChange={(e) => setGiorno(e.target.value)} required /></Field>
            <Field><FieldLabel htmlFor="c-motivo">Motivo</FieldLabel><Input id="c-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ponte di Sant'Ambrogio" /></Field>
            {errore && <Alert variant="destructive"><AlertDescription>{errore}</AlertDescription></Alert>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAperto(false)}>Annulla</Button>
              <Button type="submit" disabled={pending}>{pending ? "Salvo…" : "Aggiungi"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
