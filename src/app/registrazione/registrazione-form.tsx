"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Footprints, Users } from "lucide-react";
import type { Informativa, RuoloTipo } from "@/lib/database.types";
import { registrati } from "@/app/(app)/azioni";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { H2 } from "@/components/blocchi";
import { cn } from "@/lib/utils";

type Scuola = { id: string; nome: string };

export function RegistrazioneForm({ telefono, scuole, informativa }: { telefono: string | null; scuole: Scuola[]; informativa: Informativa | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [scuola, setScuola] = useState(scuole[0]?.id ?? "");
  const [genitore, setGenitore] = useState(false);
  const [volontario, setVolontario] = useState(false);
  const [consenso, setConsenso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const invia = () => {
    setErrore(null);
    if (!nome.trim() || !cognome.trim()) { setErrore("Scrivi nome e cognome."); return; }
    if (!genitore && !volontario) { setErrore("Dicci se sei genitore, volontario o entrambi."); return; }
    if (!informativa) { setErrore("Manca l'informativa privacy: contatta il comitato."); return; }
    if (!consenso) { setErrore("Serve il consenso all'informativa."); return; }
    if (!scuola) { setErrore("Nessuna scuola configurata: contatta il comitato."); return; }
    const ruoli: RuoloTipo[] = [...(genitore ? ["genitore" as const] : []), ...(volontario ? ["volontario" as const] : [])];
    start(async () => {
      const r = await registrati(nome, cognome, scuola, ruoli, informativa.id);
      if (!r.ok) { setErrore(r.messaggio); return; }
      router.replace(genitore ? "/iscrizione" : "/in-attesa");
      router.refresh();
    });
  };

  return (
    <form className="flex flex-col gap-[18px] px-4 pt-6 pb-6" onSubmit={(e) => { e.preventDefault(); invia(); }}>
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">Benvenuto nel Pedibus</h1>
        <p className="text-sm text-muted-foreground">Prima di entrare, dicci chi sei. Lo fai una volta sola.{telefono ? ` Il tuo numero è ${telefono}.` : ""}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field><FieldLabel htmlFor="nome">Nome</FieldLabel><Input id="nome" autoComplete="given-name" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus /></Field>
        <Field><FieldLabel htmlFor="cognome">Cognome</FieldLabel><Input id="cognome" autoComplete="family-name" value={cognome} onChange={(e) => setCognome(e.target.value)} required /></Field>
      </div>

      {scuole.length > 1 && (
        <Field>
          <FieldLabel htmlFor="scuola">Scuola</FieldLabel>
          <NativeSelect id="scuola" className="w-full" value={scuola} onChange={(e) => setScuola(e.target.value)}>
            {scuole.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.nome}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      )}

      <div className="flex flex-col gap-2">
        <H2>Chi sei</H2>
        <p className="text-[13px] leading-[1.5] text-muted-foreground">Puoi essere entrambe le cose: nell&apos;app passi da un ruolo all&apos;altro.</p>
        <Scelta on={genitore} onChange={setGenitore} icon={<Users />} titolo="Genitore" testo="Iscrivo i miei bambini e segnalo le assenze.">
          {genitore && <span className="text-[13px] text-muted-foreground">Subito dopo iscrivi i bambini. L&apos;amministratore approva e ti avvisa.</span>}
        </Scelta>
        <Scelta on={volontario} onChange={setVolontario} icon={<Footprints />} titolo="Volontario" testo="Accompagno i bambini a turno sulle linee.">
          {volontario && <span className="text-[13px] text-muted-foreground">Il comitato verifica l&apos;iscrizione all&apos;albo dei volontari civici e ti abilita.</span>}
        </Scelta>
      </div>

      <Field orientation="horizontal">
        <Checkbox id="consenso" checked={consenso} onCheckedChange={(v) => setConsenso(v === true)} />
        <FieldLabel htmlFor="consenso" className="text-[13px] leading-[1.5] font-normal">
          Ho letto l&apos;{informativa?.url ? <a className="underline" href={informativa.url} target="_blank" rel="noreferrer">informativa privacy</a> : "informativa privacy"} (versione {informativa?.versione ?? "—"}) e acconsento al trattamento dei dati per il servizio Pedibus. Titolare: comitato Officina Civica.
        </FieldLabel>
      </Field>

      {errore && <Alert variant="destructive"><AlertDescription>{errore}</AlertDescription></Alert>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Un momento…" : "Continua"}</Button>
      <FieldDescription className="text-center">Sei l&apos;amministratore? Non ci si registra come admin: chi lo è già ti nomina dall&apos;app.</FieldDescription>
    </form>
  );
}

function Scelta({ on, onChange, icon, titolo, testo, children }: { on: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; titolo: string; testo: string; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        on ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4", on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{titolo}</span>
        <span className="text-[13px] leading-[1.4] text-muted-foreground">{testo}</span>
        {children}
      </span>
      <Checkbox checked={on} tabIndex={-1} aria-hidden className="mt-1 pointer-events-none" />
    </button>
  );
}
