"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { nominaAdmin, revocaAdmin } from "@/app/(app)/azioni-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar } from "@/components/blocchi";
import { iniziali } from "@/lib/utils";

type Persona = { id: string; nome: string; cognome: string; telefono: string | null; ruoli: string[] };

/* Chi amministra il pedibus. Un admin ne nomina altri tra le persone registrate; mai l'ultimo si revoca. */
export function Amministratori({ scuolaId, io, persone }: { scuolaId: string; io: string; persone: Persona[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nomina, setNomina] = useState(false);
  const [scelto, setScelto] = useState("");
  const [daRevocare, setDaRevocare] = useState<Persona | null>(null);
  const admin = persone.filter((p) => p.ruoli.includes("admin"));
  const candidati = persone.filter((p) => !p.ruoli.includes("admin"));
  const esegui = (fn: () => Promise<{ ok: boolean; messaggio: string }>) => start(async () => { const r = await fn(); toast(r.messaggio); router.refresh(); });
  const etichetta = (p: Persona) => p.ruoli.filter((r) => r !== "admin").map((r) => r === "genitore" ? "genitore" : "volontario").join(", ");

  return (
    <Card size="sm" className="px-3">
      {admin.map((p) => (
        <div key={p.id} className="flex items-center gap-3">
          <Avatar accent={p.id === io}>{iniziali(`${p.nome} ${p.cognome}`)}</Avatar>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{p.nome} {p.cognome}{p.id === io ? " (tu)" : ""}</span>
            <span className="text-[13px] text-muted-foreground">{etichetta(p) || "solo amministratore"}</span>
          </span>
          <Badge variant="secondary"><ShieldCheck size={12} /> admin</Badge>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Revoca ${p.nome} ${p.cognome}`} disabled={pending || admin.length <= 1} title={admin.length <= 1 ? "Deve restare almeno un amministratore" : undefined} onClick={() => setDaRevocare(p)}><UserMinus /></Button>
        </div>
      ))}
      <p className="text-[13px] leading-[1.5] text-muted-foreground">L&apos;amministratore vede e decide iscrizioni, turni e linee. Si nomina tra chi si è già registrato nell&apos;app; il ruolo si aggiunge a quelli che ha.</p>
      <Button variant="outline" size="sm" className="self-start border-dashed" onClick={() => { setScelto(""); setNomina(true); }}><UserPlus /> Nomina un amministratore</Button>

      <Dialog open={nomina} onOpenChange={setNomina}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nomina un amministratore</DialogTitle>
            <DialogDescription>Riceve un avviso e da subito vede tutto. Potrà a sua volta nominare e revocare.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="nuovo-admin">Persona</FieldLabel>
            <NativeSelect id="nuovo-admin" className="w-full" value={scelto} onChange={(e) => setScelto(e.target.value)}>
              <NativeSelectOption value="">Scegli…</NativeSelectOption>
              {candidati.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.cognome} {p.nome}{etichetta(p) ? ` · ${etichetta(p)}` : ""}</NativeSelectOption>)}
            </NativeSelect>
            <FieldDescription>Solo persone registrate: chi non c&apos;è deve prima entrare nell&apos;app e registrarsi.</FieldDescription>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNomina(false)}>Annulla</Button>
            <Button disabled={pending || !scelto} onClick={() => { const id = scelto; setNomina(false); esegui(() => nominaAdmin(id, scuolaId)); }}>Nomina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!daRevocare} onOpenChange={(v) => { if (!v) setDaRevocare(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{daRevocare?.id === io ? "Rinunciare al ruolo di amministratore?" : `Revocare ${daRevocare?.nome} ${daRevocare?.cognome}?`}</AlertDialogTitle>
            <AlertDialogDescription>{daRevocare?.id === io ? "Da subito non vedrai più la parte di amministrazione. Gli altri tuoi ruoli restano." : "Perde l'accesso all'amministrazione, gli altri ruoli restano. Riceve un avviso."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={() => { const p = daRevocare!; setDaRevocare(null); esegui(() => revocaAdmin(p.id, scuolaId)); }}>Revoca</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
