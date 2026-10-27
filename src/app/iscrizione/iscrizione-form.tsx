"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { iscriviBambini } from "@/app/(app)/azioni";
import type { Informativa } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { H2 } from "@/components/blocchi";
import { hhmm } from "@/lib/date";

type Scuola = { id: string; nome: string };
type Linea = { id: string; scuola_id: string; nome: string };
type Fermata = { id: string; linea_id: string; ordine: number; nome: string; orario: string };
type Bambino = { nome: string; cognome: string; classe: string; genere: "F" | "M" | ""; fermata: string };
const CLASSI = ["1ª A", "1ª B", "1ª C", "2ª A", "2ª B", "2ª C", "3ª A", "3ª B", "3ª C", "4ª A", "4ª B", "4ª C", "5ª A", "5ª B", "5ª C"];

export function IscrizioneForm({ persona, scuole, linee, fermate, informativa }: { persona: { nome: string; cognome: string; telefono: string | null; informativaId: string | null }; scuole: Scuola[]; linee: Linea[]; fermate: Fermata[]; informativa: Informativa | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scuola, setScuola] = useState(scuole[0]?.id ?? "");
  const [cognome, setCognome] = useState(persona.cognome);
  const [bambini, setBambini] = useState<Bambino[]>([{ nome: "", cognome: persona.cognome, classe: CLASSI[0], genere: "", fermata: "" }]);
  // Il primo contatto d'emergenza è chi sta iscrivendo: nome, cognome e telefono della registrazione.
  // Si sceglie solo come farsi chiamare (mamma, papà…).
  const [relazioneGenitore, setRelazioneGenitore] = useState("genitore");
  const [contatti, setContatti] = useState([{ nome: "", relazione: "", telefono: "" }]);
  const primoContatto = { nome: `${persona.nome} ${persona.cognome}`.trim(), relazione: relazioneGenitore, telefono: persona.telefono ?? "" };
  // Consenso: dato in registrazione per questa versione dell'informativa → non si richiede.
  const consensoGiaDato = !!informativa && persona.informativaId === informativa.id;
  const tuttiIContatti = [primoContatto, ...contatti];
  const [consenso, setConsenso] = useState(consensoGiaDato);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState<string[] | null>(null);

  const lineeScuola = linee.filter((l) => l.scuola_id === scuola);
  const opzioniFermate = lineeScuola.flatMap((l) => fermate.filter((f) => f.linea_id === l.id).map((f) => ({ id: f.id, linea: l.id, label: `${l.nome} · ${f.ordine}, ${f.nome} (${hhmm(f.orario)})` })));

  const invia = () => {
    setErrore(null);
    if (!informativa) { setErrore("Manca l'informativa privacy: contatta il comitato."); return; }
    if (!consenso) { setErrore("Serve il consenso all'informativa."); return; }
    for (const b of bambini) if (!b.nome.trim() || !b.cognome.trim()) { setErrore("Per ogni bambino servono nome e cognome."); return; }
    start(async () => {
      const r = await iscriviBambini(scuola, informativa.id,
        bambini.map((b) => {
          const fermata = b.fermata ? opzioniFermate.find((o) => o.id === b.fermata) ?? null : null;
          return { nome: b.nome, cognome: b.cognome, classe: b.classe, genere: b.genere || null, lineaId: fermata?.linea ?? null, fermataId: fermata?.id ?? null };
        }),
        tuttiIContatti.filter((c) => c.nome && c.telefono).map((c, i) => ({ ...c, relazione: c.relazione || "contatto", ordine: i + 1 })),
      );
      if (!r.ok) { setErrore(r.messaggio); return; }
      setFatto(r.iscritti);
    });
  };

  if (fatto) {
    return (
      <div className="flex flex-col items-center gap-3.5 px-4 pt-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand"><Check size={28} /></span>
        <h1 className="text-[22px] font-bold tracking-tight">Iscrizione inviata</h1>
        <p className="text-sm text-muted-foreground">Grazie{persona?.nome ? ` ${persona.nome}` : ""}. L&apos;amministratore la verifica e la approva: riceverai un avviso. Fino ad allora {fatto.length > 1 ? "i bambini non risultano iscritti" : "il bambino non risulta iscritto"}.</p>
        <Button variant="outline" size="lg" className="w-full" onClick={() => { router.replace("/"); router.refresh(); }}>Torna all&apos;app</Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-[18px] px-4 pt-[18px] pb-6" onSubmit={(e) => { e.preventDefault(); invia(); }}>
      <div><h1 className="text-[22px] font-bold tracking-tight">Iscrivi i tuoi bambini</h1><p className="text-sm text-muted-foreground">L&apos;amministratore approva l&apos;iscrizione. Riceverai un avviso.</p></div>

      {scuole.length > 1 && (
        <Field>
          <FieldLabel htmlFor="scuola">Scuola</FieldLabel>
          <NativeSelect id="scuola" className="w-full" value={scuola} onChange={(e) => setScuola(e.target.value)}>
            {scuole.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.nome}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      )}

      <div className="flex flex-col gap-1">
        <H2>Genitore</H2>
        <p className="text-sm"><b>{persona.nome} {persona.cognome}</b>{persona.telefono ? <span className="text-muted-foreground"> · {persona.telefono}</span> : null}</p>
        <p className="text-[13px] text-muted-foreground">Il numero con cui sei entrato è quello degli avvisi. Nome e cognome si cambiano dal Profilo.</p>
      </div>

      {bambini.map((b, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex items-center justify-between"><H2>{bambini.length > 1 ? `Bambino ${i + 1}` : "Bambino"}</H2>{bambini.length > 1 && <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Togli questo bambino" onClick={() => setBambini(bambini.filter((_, j) => j !== i))}><Trash2 /></Button>}</div>
          <Card size="sm" className="px-3">
            <div className="grid grid-cols-2 gap-2.5">
              <Field><FieldLabel htmlFor={`nome${i}`}>Nome</FieldLabel><Input id={`nome${i}`} value={b.nome} onChange={(e) => setBambini(bambini.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} required /></Field>
              <Field><FieldLabel htmlFor={`cognome${i}`}>Cognome</FieldLabel><Input id={`cognome${i}`} value={b.cognome} onChange={(e) => { setCognome(e.target.value); setBambini(bambini.map((x, j) => j === i ? { ...x, cognome: e.target.value } : x)); }} required /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field>
                <FieldLabel htmlFor={`classe${i}`}>Classe</FieldLabel>
                <NativeSelect id={`classe${i}`} className="w-full" value={b.classe} onChange={(e) => setBambini(bambini.map((x, j) => j === i ? { ...x, classe: e.target.value } : x))}>
                  {CLASSI.map((c) => <NativeSelectOption key={c}>{c}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor={`genere${i}`}>Bambina / bambino</FieldLabel>
                <NativeSelect id={`genere${i}`} className="w-full" value={b.genere} onChange={(e) => setBambini(bambini.map((x, j) => j === i ? { ...x, genere: e.target.value as Bambino["genere"] } : x))}>
                  <NativeSelectOption value="">—</NativeSelectOption><NativeSelectOption value="F">Bambina</NativeSelectOption><NativeSelectOption value="M">Bambino</NativeSelectOption>
                </NativeSelect>
                <FieldDescription>Serve solo per scrivere bene gli avvisi</FieldDescription>
              </Field>
            </div>
            <div className="border-t border-dashed pt-2.5">
              <Field>
                <FieldLabel htmlFor={`fermata${i}`}>Fermata dove sale</FieldLabel>
                <NativeSelect id={`fermata${i}`} className="w-full" value={b.fermata} onChange={(e) => setBambini(bambini.map((x, j) => j === i ? { ...x, fermata: e.target.value } : x))}>
                  <NativeSelectOption value="">Non lo so ancora: la decidiamo col comitato</NativeSelectOption>
                  {opzioniFermate.map((o) => <NativeSelectOption key={o.id} value={o.id}>{o.label}</NativeSelectOption>)}
                </NativeSelect>
                <FieldDescription>Se non la sai, lasciala vuota: l&apos;amministratore la assegna quando approva.</FieldDescription>
              </Field>
            </div>
          </Card>
        </div>
      ))}
      <Button variant="outline" className="w-full border-dashed" onClick={() => setBambini([...bambini, { nome: "", cognome, classe: CLASSI[0], genere: "", fermata: "" }])}><Plus /> Aggiungi un altro bambino</Button>

      <div className="flex flex-col gap-2">
        <H2>Contatti d&apos;emergenza</H2>
        <p className="text-[13px] leading-[1.5] text-muted-foreground">Li vede solo il volontario di turno sulla linea, durante il turno. Nessun dato sanitario.</p>
        <div className="grid grid-cols-[1.3fr_1fr_1.2fr] items-center gap-2">
          <span className="truncate text-sm" title={primoContatto.nome || undefined}>{primoContatto.nome || <span className="text-muted-foreground">Tu (nome qui sopra)</span>}</span>
          <Input placeholder="mamma, papà…" aria-label="Come farti chiamare" value={relazioneGenitore} onChange={(e) => setRelazioneGenitore(e.target.value)} />
          <span className="truncate text-sm tabular-nums text-muted-foreground">{primoContatto.telefono || "—"}</span>
        </div>
        {contatti.map((c, i) => (
          <div key={i} className="grid grid-cols-[1.3fr_1fr_1.2fr] gap-2">
            <Input placeholder="Nome" aria-label={`Contatto ${i + 2}: nome`} value={c.nome} onChange={(e) => setContatti(contatti.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
            <Input placeholder="mamma, nonno…" aria-label={`Contatto ${i + 2}: chi è`} value={c.relazione} onChange={(e) => setContatti(contatti.map((x, j) => j === i ? { ...x, relazione: e.target.value } : x))} />
            <Input placeholder="+39 3xx…" type="tel" aria-label={`Contatto ${i + 2}: telefono`} value={c.telefono} onChange={(e) => setContatti(contatti.map((x, j) => j === i ? { ...x, telefono: e.target.value } : x))} />
          </div>
        ))}
        <Button variant="outline" size="sm" className="self-start border-dashed" onClick={() => setContatti([...contatti, { nome: "", relazione: "", telefono: "" }])}><Plus /> Un altro contatto</Button>
      </div>

      {consensoGiaDato ? (
        <p className="text-[13px] text-muted-foreground">Vale l&apos;informativa privacy (versione {informativa?.versione}) che hai accettato alla registrazione.</p>
      ) : (
        <Field orientation="horizontal">
          <Checkbox id="consenso" checked={consenso} onCheckedChange={(v) => setConsenso(v === true)} />
          <FieldLabel htmlFor="consenso" className="text-[13px] leading-[1.5] font-normal">Ho letto l&apos;{informativa?.url ? <a className="underline" href={informativa.url} target="_blank" rel="noreferrer">informativa privacy</a> : "informativa privacy"} (versione {informativa?.versione ?? "—"}) e acconsento al trattamento dei dati per il servizio Pedibus. Titolare: comitato Officina Civica.</FieldLabel>
        </Field>
      )}

      {errore && <Alert variant="destructive"><AlertDescription>{errore}</AlertDescription></Alert>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Invio…" : "Invia l'iscrizione"}</Button>
    </form>
  );
}
