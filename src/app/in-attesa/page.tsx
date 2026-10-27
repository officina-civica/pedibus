import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { getSessione, nomeCompleto } from "@/lib/sessione";
import { supabaseServer } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rows, Row } from "@/components/blocchi";
import { esci } from "@/app/(app)/azioni";

export const metadata: Metadata = { title: "In attesa" };

const ETICHETTA = { genitore: "Genitore", volontario: "Volontario", admin: "Amministratore" } as const;

/* Registrato, ma nessun ruolo ancora approvato: cosa manca, ruolo per ruolo. */
export default async function InAttesaPage() {
  const s = await getSessione();
  if (!s.registrato) redirect("/registrazione");
  if (s.ruoloAttivo) redirect("/");
  const supabase = await supabaseServer();
  const { count: bambini } = await supabase.from("bambini").select("id", { count: "exact", head: true }).eq("genitore_id", s.userId);

  const richiesti = s.ruoliRichiesti.filter((r) => r.ruolo !== "admin");
  const genitore = richiesti.find((r) => r.ruolo === "genitore");
  const volontario = richiesti.find((r) => r.ruolo === "volontario");
  const senzaBambini = !!genitore && (bambini ?? 0) === 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-3.5 px-4 pt-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand"><Hourglass size={28} /></span>
      <h1 className="text-[22px] font-bold tracking-tight">{nomeCompleto(s.persona) ? `Ciao ${s.persona!.nome}` : "Quasi pronto"}</h1>

      {richiesti.length === 0 ? (
        <p className="text-sm text-muted-foreground">Non hai ancora chiesto nessun ruolo. Torna alla registrazione per dirci se sei genitore o volontario.</p>
      ) : (
        <Rows className="w-full text-left">
          {genitore && (
            <Row className="min-h-14">
              <span className="flex-1"><b>{ETICHETTA.genitore}</b><span className="block text-[13px] text-muted-foreground">{senzaBambini ? "Manca l'iscrizione dei bambini." : genitore.stato === "rifiutata" ? "Iscrizione non approvata: contatta il comitato." : "L'amministratore sta verificando l'iscrizione: quando approva ricevi un avviso."}</span></span>
              <Badge variant={genitore.stato === "rifiutata" ? "destructive" : senzaBambini ? "secondary" : "brand"}>{genitore.stato === "rifiutata" ? "rifiutata" : senzaBambini ? "da completare" : "in attesa"}</Badge>
            </Row>
          )}
          {volontario && (
            <Row className="min-h-14">
              <span className="flex-1"><b>{ETICHETTA.volontario}</b><span className="block text-[13px] text-muted-foreground">{volontario.stato === "rifiutata" ? (volontario.note || "Richiesta non approvata: contatta il comitato.") : "Il comitato verifica l'iscrizione all'albo dei volontari civici e ti abilita."}</span></span>
              <Badge variant={volontario.stato === "rifiutata" ? "destructive" : "brand"}>{volontario.stato === "rifiutata" ? "rifiutata" : "in attesa"}</Badge>
            </Row>
          )}
        </Rows>
      )}

      {senzaBambini && <Button size="lg" className="mt-2 w-full" render={<Link href="/iscrizione" />}>Iscrivi i tuoi bambini</Button>}
      {richiesti.length === 0 && <Button size="lg" className="mt-2 w-full" render={<Link href="/registrazione" />}>Vai alla registrazione</Button>}
      {!senzaBambini && richiesti.length > 0 && <p className="text-[13px] text-muted-foreground">Appena un ruolo viene approvato, l&apos;app si apre da sola al prossimo accesso.</p>}
      <form action={esci} className="mt-2 w-full"><Button type="submit" variant="outline" size="lg" className="w-full">Esci</Button></form>
    </main>
  );
}
