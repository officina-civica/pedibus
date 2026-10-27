"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Informativa } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Card, H2 } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { hhmm } from "@/lib/date";

type Scuola = { id: string; nome: string };
type Linea = { id: string; scuola_id: string; nome: string };
type Fermata = { id: string; linea_id: string; ordine: number; nome: string; orario: string };
type Bambino = { nome: string; cognome: string; classe: string; genere: "F" | "M" | ""; fermata: string };
const CLASSI = ["1ª A", "1ª B", "1ª C", "2ª A", "2ª B", "2ª C", "3ª A", "3ª B", "3ª C", "4ª A", "4ª B", "4ª C", "5ª A", "5ª B", "5ª C"];

export function IscrizioneForm({ persona, scuole, linee, fermate, informativa }: { persona: { nome: string; cognome: string; telefono: string | null } | null; scuole: Scuola[]; linee: Linea[]; fermate: Fermata[]; informativa: Informativa | null }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [pending, start] = useTransition();
  const [scuola, setScuola] = useState(scuole[0]?.id ?? "");
  const [cognome, setCognome] = useState(persona?.cognome ?? "");
  const [genNome, setGenNome] = useState(persona?.nome ?? "");
  const [genCognome, setGenCognome] = useState(persona?.cognome ?? "");
  const [bambini, setBambini] = useState<Bambino[]>([{ nome: "", cognome: persona?.cognome ?? "", classe: CLASSI[0], genere: "", fermata: "" }]);
  const [contatti, setContatti] = useState([{ nome: persona ? `${persona.nome} ${persona.cognome}` : "", relazione: "genitore", telefono: persona?.telefono ?? "" }, { nome: "", relazione: "", telefono: "" }]);
  const [consenso, setConsenso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState<string[] | null>(null);

  const lineeScuola = linee.filter((l) => l.scuola_id === scuola);
  const opzioniFermate = lineeScuola.flatMap((l) => fermate.filter((f) => f.linea_id === l.id).map((f) => ({ id: f.id, linea: l.id, label: `${l.nome} · ${f.ordine}, ${f.nome} (${hhmm(f.orario)})` })));

  const invia = () => {
    setErrore(null);
    if (!informativa) { setErrore("Manca l'informativa privacy: contatta il comitato."); return; }
    if (!consenso) { setErrore("Serve il consenso all'informativa."); return; }
    for (const b of bambini) if (!b.nome.trim() || !b.cognome.trim() || !b.fermata) { setErrore("Per ogni bambino servono nome, cognome e fermata."); return; }
    if (!genNome.trim() || !genCognome.trim()) { setErrore("Scrivi nome e cognome del genitore."); return; }
    start(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from("persone").update({ nome: genNome.trim(), cognome: genCognome.trim() }).eq("id", user.id);
        if (error) { setErrore(error.message); return; }
      }
      const nomi: string[] = [];
      for (const b of bambini) {
        const fermata = opzioniFermate.find((o) => o.id === b.fermata)!;
        const { error } = await supabase.rpc("iscrivi_bambino", {
          p_scuola: scuola, p_nome: b.nome.trim(), p_cognome: b.cognome.trim(), p_classe: b.classe, p_genere: b.genere || null,
          p_linea: fermata.linea, p_fermata: fermata.id, p_informativa: informativa.id,
          p_contatti: contatti.filter((c) => c.nome && c.telefono).map((c, i) => ({ ...c, relazione: c.relazione || "contatto", ordine: i + 1 })),
        });
        if (error) { setErrore(error.message); return; }
        nomi.push(b.nome.trim());
      }
      setFatto(nomi);
    });
  };

  if (fatto) {
    return (
      <div className="flex flex-col items-center gap-3.5 px-4 pt-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent-fg"><Check size={28} /></span>
        <h1 className="text-[22px] font-bold tracking-tight">Iscrizione inviata</h1>
        <p className="text-sm text-muted">Grazie{persona?.nome ? ` ${persona.nome}` : ""}. L&apos;amministratore la verifica e la approva: riceverai un avviso. Fino ad allora {fatto.length > 1 ? "i bambini non risultano iscritti" : "il bambino non risulta iscritto"}.</p>
        <Button block onClick={() => { router.replace("/"); router.refresh(); }}>Torna all&apos;app</Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-[18px] px-4 pt-[18px] pb-6" onSubmit={(e) => { e.preventDefault(); invia(); }}>
      <div><h1 className="text-[22px] font-bold tracking-tight">Iscrivi i tuoi bambini</h1><p className="text-sm text-muted">L&apos;amministratore approva l&apos;iscrizione. Riceverai un avviso.</p></div>

      {scuole.length > 1 && (
        <Field label="Scuola" htmlFor="scuola">
          <select id="scuola" className="h-12 w-full rounded-md border border-border bg-card px-3 text-base" value={scuola} onChange={(e) => setScuola(e.target.value)}>
            {scuole.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Field>
      )}

      <div className="flex flex-col gap-2">
        <H2>Genitore principale</H2>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Nome" htmlFor="gnome"><Input id="gnome" value={genNome} onChange={(e) => setGenNome(e.target.value)} required /></Field>
          <Field label="Cognome" htmlFor="gcognome"><Input id="gcognome" value={genCognome} onChange={(e) => { setGenCognome(e.target.value); if (!cognome) setCognome(e.target.value); }} required /></Field>
        </div>
        <p className="text-[13px] text-muted">{persona?.telefono ? `Telefono ${persona.telefono}: ` : ""}il numero con cui sei entrato è quello degli avvisi.</p>
      </div>

      {bambini.map((b, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex items-center justify-between"><H2>{bambini.length > 1 ? `Bambino ${i + 1}` : "Bambino"}</H2>{bambini.length > 1 && <button type="button" className="text-[13px] text-muted" onClick={() => setBambini(bambini.filter((_, j) => j !== i))}><Trash2 size={14} /></button>}</div>
          <Card>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Nome" htmlFor={`nome${i}`}><Input id={`nome${i}`} value={b.nome} onChange={(e) => setBambini(bambini.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} required /></Field>
              <Field label="Cognome" htmlFor={`cognome${i}`}><Input id={`cognome${i}`} value={b.cognome} onChange={(e) => { setCognome(e.target.value); setBambini(bambini.map((x, j) => j === i ? { ...x, cognome: e.target.value } : x)); }} required /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Classe" htmlFor={`classe${i}`}>
                <select id={`classe${i}`} className="h-12 w-full rounded-md border border-border bg-card px-3 text-base" value={b.classe} onChange={(e) => setBambini(bambini.map((x, j) => j === i ? { ...x, classe: e.target.value } : x))}>
                  {CLASSI.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Bambina / bambino" htmlFor={`genere${i}`} hint="Serve solo per scrivere bene gli avvisi">
                <select id={`genere${i}`} className="h-12 w-full rounded-md border border-border bg-card px-3 text-base" value={b.genere} onChange={(e) => setBambini(bambini.map((x, j) => j === i ? { ...x, genere: e.target.value as Bambino["genere"] } : x))}>
                  <option value="">—</option><option value="F">Bambina</option><option value="M">Bambino</option>
                </select>
              </Field>
            </div>
            <div className="border-t border-dashed border-border pt-2.5">
              <Field label="Fermata dove sale" htmlFor={`fermata${i}`} hint="Si sceglie a parte: non dipende da scuola e classe.">
                <select id={`fermata${i}`} className="h-12 w-full rounded-md border border-border bg-card px-3 text-base" value={b.fermata} onChange={(e) => setBambini(bambini.map((x, j) => j === i ? { ...x, fermata: e.target.value } : x))} required>
                  <option value="">Scegli la fermata…</option>
                  {opzioniFermate.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </Card>
        </div>
      ))}
      <Button variant="dashed" block onClick={() => setBambini([...bambini, { nome: "", cognome, classe: CLASSI[0], genere: "", fermata: "" }])}><Plus size={16} /> Aggiungi un altro bambino</Button>

      <div className="flex flex-col gap-2">
        <H2>Contatti d&apos;emergenza</H2>
        <p className="text-[13px] leading-[1.5] text-muted">Li vede solo il volontario di turno sulla linea, durante il turno. Nessun dato sanitario.</p>
        {contatti.map((c, i) => (
          <div key={i} className="grid grid-cols-[1.3fr_1fr_1.2fr] gap-2">
            <Input placeholder="Nome" value={c.nome} onChange={(e) => setContatti(contatti.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
            <Input placeholder="mamma, nonno…" value={c.relazione} onChange={(e) => setContatti(contatti.map((x, j) => j === i ? { ...x, relazione: e.target.value } : x))} />
            <Input placeholder="+39 3xx…" type="tel" value={c.telefono} onChange={(e) => setContatti(contatti.map((x, j) => j === i ? { ...x, telefono: e.target.value } : x))} />
          </div>
        ))}
      </div>

      <label className="flex items-start gap-3 text-[13px] leading-[1.5]">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-accent" checked={consenso} onChange={(e) => setConsenso(e.target.checked)} required />
        <span>Ho letto l&apos;{informativa?.url ? <a className="underline" href={informativa.url} target="_blank" rel="noreferrer">informativa privacy</a> : "informativa privacy"} (versione {informativa?.versione ?? "—"}) e acconsento al trattamento dei dati per il servizio Pedibus. Titolare: comitato Officina Civica.</span>
      </label>

      {errore && <Alert tone="danger">{errore}</Alert>}
      <Button type="submit" variant="primary" size="lg" block disabled={pending}>{pending ? "Invio…" : "Invia l'iscrizione"}</Button>
    </form>
  );
}
