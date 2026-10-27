"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Flag, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Fermata, Linea } from "@/lib/database.types";
import { hhmm } from "@/lib/date";
import { eliminaFermata, salvaFermata, sospendiLinea, spostaFermata, spostaIscrizione } from "@/app/(app)/azioni-admin";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { H2 } from "@/components/blocchi";
import { LineaDialog } from "./linea-dialog";

type BambinoAllaFermata = { iscrizioneId: string; nome: string; classe: string };
type Destinazione = { id: string; nome: string; fermate: { id: string; label: string }[] };
type Props = { scuolaId: string; linea: Linea; fermate: Fermata[]; bambiniPerFermata: Record<string, BambinoAllaFermata[]>; iscritti: number; destinazioni: Destinazione[] };

/* La scheda di una linea, come la vede l'amministratore: si modifica, si sospende, si lavora sulle fermate. */
export function LineaCard({ scuolaId, linea: l, fermate: st, bambiniPerFermata, iscritti, destinazioni }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modifica, setModifica] = useState(false);
  const [sospensione, setSospensione] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [fermata, setFermata] = useState<{ aperta: boolean; f?: Fermata }>({ aperta: false });
  const [daEliminare, setDaEliminare] = useState<Fermata | null>(null);
  const [bambiniDi, setBambiniDi] = useState<Fermata | null>(null);

  const esegui = (fn: () => Promise<{ ok: boolean; messaggio: string }>) => start(async () => { const r = await fn(); toast(r.messaggio); router.refresh(); });
  const ultimaSalita = [...st].reverse().find((f) => !f.arrivo);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border" data-linea={l.nome}>
      <div className="flex items-center gap-3 bg-muted px-3 py-3">
        <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: l.colore }} />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">{l.nome}</span>
          <span className="text-[13px] text-muted-foreground">{st.filter((f) => !f.arrivo).length} fermate · {iscritti} bambini · {hhmm(l.ora_partenza)} → {hhmm(l.ora_arrivo)}</span>
        </span>
        <Badge variant={l.attiva ? "success" : "secondary"}>{l.attiva ? "attiva" : "sospesa"}</Badge>
        <Button variant="ghost" size="icon-sm" aria-label={`Modifica ${l.nome}`} onClick={() => setModifica(true)}><Pencil /></Button>
      </div>

      {st.map((f) => (
        /* Nome su una riga, orario e bambini sotto: così il nome ha spazio anche sui telefoni stretti e non finisce sopra l'orario. */
        <div key={f.id} className="flex min-h-12 items-center gap-2 border-t border-border py-1 pr-1 pl-3">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${f.arrivo ? "bg-brand text-brand-foreground" : "bg-primary text-primary-foreground"}`}>{f.arrivo ? <Flag size={12} strokeWidth={3} /> : f.ordine}</span>
          <span className="min-w-0 flex-1">
            <span data-fermata-nome className="block text-sm font-medium leading-tight break-words">{f.nome}{f.capolinea ? <span className="font-normal text-muted-foreground"> · capolinea</span> : f.arrivo ? <span className="font-normal text-muted-foreground"> · arrivo</span> : null}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
              <span className="tabular-nums">{hhmm(f.orario)}</span>
              {!f.arrivo && (
                <button type="button" aria-label={`Bambini alla fermata ${f.nome}`} disabled={!(bambiniPerFermata[f.id]?.length)} onClick={() => setBambiniDi(f)}
                  className="rounded-full bg-muted px-2 py-px text-[11px] font-semibold whitespace-nowrap text-foreground enabled:hover:bg-brand/10 enabled:hover:text-brand disabled:cursor-default disabled:text-muted-foreground">
                  {bambiniPerFermata[f.id]?.length ? `${bambiniPerFermata[f.id].length} ${bambiniPerFermata[f.id].length === 1 ? "bambino" : "bambini"}` : "nessun bambino"}
                </button>
              )}
            </span>
          </span>
          <span className="flex shrink-0 items-center">
            <Button variant="ghost" size="icon-sm" aria-label={`Sposta su ${f.nome}`} disabled={pending || f.capolinea || f.arrivo || f.ordine <= 2} onClick={() => esegui(() => spostaFermata(f.id, true))}><ArrowUp /></Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Sposta giù ${f.nome}`} disabled={pending || f.capolinea || f.arrivo || f.ordine >= st.length - 1} onClick={() => esegui(() => spostaFermata(f.id, false))}><ArrowDown /></Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Modifica ${f.nome}`} onClick={() => setFermata({ aperta: true, f })}><Pencil /></Button>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Elimina ${f.nome}`} disabled={pending || f.capolinea || f.arrivo} onClick={() => setDaEliminare(f)}><Trash2 /></Button>
          </span>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
        <Button variant="outline" size="sm" className="border-dashed" onClick={() => setFermata({ aperta: true })}><Plus /> Aggiungi fermata</Button>
        {l.attiva
          ? <Button variant="outline" size="sm" onClick={() => { setMotivo(""); setSospensione(true); }}><Pause /> Sospendi</Button>
          : <Button size="sm" onClick={() => { setMotivo(""); setSospensione(true); }}><Play /> Riattiva</Button>}
      </div>

      <div className="grid grid-cols-3 border-t border-border">
        <div className="border-r border-border px-3 py-2.5"><H2 className="text-[11px]">Volontari min.</H2><b className="text-base">{l.min_volontari}</b> <span className="text-[13px] text-muted-foreground">(cons. {l.volontari_consigliati})</span></div>
        <div className="border-r border-border px-3 py-2.5"><H2 className="text-[11px]">Soglia bimbi</H2><b className="text-base">{l.soglia_bambini}</b></div>
        <div className="px-3 py-2.5"><H2 className="text-[11px]">Chiusura</H2><b className="text-base">{hhmm(l.ora_chiusura_assenze)}</b> <span className="text-[13px] text-muted-foreground">/ {hhmm(l.ora_soglia_definitiva)}</span></div>
      </div>

      {modifica && <LineaDialog scuolaId={scuolaId} linea={l} open={modifica} onOpenChange={setModifica} />}
      {bambiniDi && <BambiniFermataDialog linea={l} fermata={bambiniDi} bambini={bambiniPerFermata[bambiniDi.id] ?? []} destinazioni={destinazioni} open onOpenChange={(v) => { if (!v) setBambiniDi(null); }} />}
      {fermata.aperta && <FermataDialog lineaId={l.id} fermata={fermata.f} dopoId={ultimaSalita?.id} open={fermata.aperta} onOpenChange={(v) => setFermata({ aperta: v })} />}

      <AlertDialog open={sospensione} onOpenChange={setSospensione}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{l.attiva ? `Sospendere ${l.nome}?` : `Riattivare ${l.nome}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {l.attiva
                ? "I turni già programmati da oggi in poi vengono annullati; famiglie e volontari ricevono un avviso. Le iscrizioni dei bambini restano valide."
                : "Le famiglie ricevono un avviso. I turni tornano con la prossima bozza del mese: ricordati di generarla."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="motivo">Messaggio alle famiglie (facoltativo)</FieldLabel>
            <Textarea id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={l.attiva ? "Es. lavori stradali in via Battisti fino al 15 novembre" : "Es. da lunedì si riparte"} />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={() => { setSospensione(false); esegui(() => sospendiLinea(l.id, !l.attiva, motivo.trim() || undefined)); }}>{l.attiva ? "Sospendi la linea" : "Riattiva la linea"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!daEliminare} onOpenChange={(v) => { if (!v) setDaEliminare(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la fermata {daEliminare?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>Si può eliminare solo se nessun bambino vi è iscritto; altrimenti prima si spostano le iscrizioni.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={() => { const f = daEliminare!; setDaEliminare(null); esegui(() => eliminaFermata(f.id)); }}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* Nuova fermata (inserita prima dell'arrivo) o modifica di nome e orario. */
function FermataDialog({ lineaId, fermata, dopoId, open, onOpenChange }: { lineaId: string; fermata?: Fermata; dopoId?: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nome, setNome] = useState(fermata?.nome ?? "");
  const [orario, setOrario] = useState(fermata ? fermata.orario.slice(0, 5) : "");
  const [errore, setErrore] = useState<string | null>(null);
  const fissa = !!fermata && (fermata.capolinea || fermata.arrivo);

  const salva = () => {
    setErrore(null);
    if (!nome.trim()) { setErrore("Serve il nome della fermata."); return; }
    if (!orario) { setErrore("Serve l'orario di passaggio."); return; }
    start(async () => {
      const r = await salvaFermata(lineaId, nome.trim(), orario, fermata?.id, fermata ? undefined : dopoId);
      if (!r.ok) { setErrore(r.messaggio); return; }
      toast(r.messaggio); onOpenChange(false); router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fermata ? `Modifica fermata ${fermata.ordine}` : "Nuova fermata"}</DialogTitle>
          <DialogDescription>{fermata ? (fissa ? "Capolinea e arrivo restano ai capi della linea: qui si cambia solo il nome." : "Nome e orario di passaggio.") : "Si aggiunge in coda alle fermate di salita, prima dell'arrivo; poi la sposti con le frecce."}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); salva(); }}>
          <Field>
            <FieldLabel htmlFor="f-nome">Nome</FieldLabel>
            <Input id="f-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Via Roma, farmacia" required autoFocus />
            <FieldDescription>Un punto riconoscibile: via e numero, o un negozio.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="f-orario">Orario di passaggio</FieldLabel>
            <Input id="f-orario" type="time" value={orario} onChange={(e) => setOrario(e.target.value)} disabled={fissa} required />
            {fissa && <FieldDescription>Segue l&apos;orario di {fermata!.capolinea ? "partenza" : "arrivo"} della linea.</FieldDescription>}
          </Field>
          {errore && <Alert variant="destructive"><AlertDescription>{errore}</AlertDescription></Alert>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvo…" : fermata ? "Salva" : "Aggiungi"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* I bambini iscritti a una fermata: da qui si spostano, su un'altra fermata o un'altra linea. */
function BambiniFermataDialog({ linea, fermata, bambini, destinazioni, open, onOpenChange }: { linea: Linea; fermata: Fermata; bambini: BambinoAllaFermata[]; destinazioni: Destinazione[]; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [inSpostamento, setInSpostamento] = useState<string | null>(null);
  const [dest, setDest] = useState<{ linea: string; fermata: string }>({ linea: linea.id, fermata: "" });
  const fermateDest = destinazioni.find((d) => d.id === dest.linea)?.fermate.filter((f) => f.id !== fermata.id) ?? [];

  const sposta = (iscrizioneId: string) => start(async () => {
    const r = await spostaIscrizione(iscrizioneId, dest.linea, dest.fermata);
    toast(r.messaggio);
    if (r.ok) { setInSpostamento(null); router.refresh(); }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fermata {fermata.ordine}, {fermata.nome}</DialogTitle>
          <DialogDescription>{bambini.length} {bambini.length === 1 ? "bambino iscritto" : "bambini iscritti"} · {linea.nome}. Spostandone uno, il genitore riceve un avviso.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col divide-y">
          {bambini.map((b) => (
            <div key={b.iscrizioneId} className="flex flex-col gap-2 py-2.5">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{b.nome}</span><span className="text-[13px] text-muted-foreground">{b.classe}</span></span>
                {inSpostamento === b.iscrizioneId
                  ? <Button variant="ghost" size="sm" onClick={() => setInSpostamento(null)}>Annulla</Button>
                  : <Button variant="outline" size="sm" onClick={() => { setInSpostamento(b.iscrizioneId); setDest({ linea: linea.id, fermata: "" }); }}>Sposta</Button>}
              </div>
              {inSpostamento === b.iscrizioneId && (
                /* Una riga per campo: sul telefono due tendine affiancate non mostrano nemmeno il nome della linea. */
                <div className="flex flex-col gap-2">
                  <NativeSelect aria-label="Linea di destinazione" size="sm" className="w-full" value={dest.linea} onChange={(e) => setDest({ linea: e.target.value, fermata: "" })}>
                    {destinazioni.map((d) => <NativeSelectOption key={d.id} value={d.id}>{d.nome}</NativeSelectOption>)}
                  </NativeSelect>
                  <NativeSelect aria-label="Fermata di destinazione" size="sm" className="w-full" value={dest.fermata} onChange={(e) => setDest({ ...dest, fermata: e.target.value })}>
                    <NativeSelectOption value="">Fermata di destinazione…</NativeSelectOption>
                    {fermateDest.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.label}</NativeSelectOption>)}
                  </NativeSelect>
                  <Button size="sm" className="self-end" disabled={pending || !dest.fermata} onClick={() => sposta(b.iscrizioneId)}>Conferma lo spostamento</Button>
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
