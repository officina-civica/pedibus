import type { Metadata } from "next";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessione } from "@/lib/sessione";
import { hhmm, oggiRome, quando } from "@/lib/date";
import { Alert } from "@/components/ui/alert";
import { Card, H2 } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TurnoAdmin } from "./turno-admin";
import { ProssimoTurno } from "./prossimo-turno";
import { PARTE, ETICHETTA_TURNO as ETICHETTA } from "@/lib/turni";

export const metadata: Metadata = { title: "Turni" };

export default async function TurniPage() {
  const s = await getSessione();
  if (s.ruoloAttivo === "admin") return <TurnoAdmin />;
  const supabase = await supabaseServer();

  const { data: prossimoId } = await supabase.rpc("mio_prossimo_turno", {});
  const [{ data: dettaglio }, { data: settimana }, { data: eccezioni }, { data: bozze }] = await Promise.all([
    prossimoId ? supabase.rpc("turno_dettaglio", { p_turno: prossimoId }) : Promise.resolve({ data: null }),
    supabase.rpc("miei_turni", { p_da: lunedi(oggiRome()), p_a: aggiungi(lunedi(oggiRome()), 13) }),
    supabase.from("eccezioni_disponibilita").select("*").eq("volontario_id", s.userId).gte("giorno", oggiRome()),
    supabase.from("bozze_turni").select("*").order("mese", { ascending: false }).limit(1),
  ]);
  const bozza = bozze?.[0] ?? null;
  const prossimoMese = new Date(oggiRome() + "T12:00:00"); prossimoMese.setMonth(prossimoMese.getMonth() + 1);
  const nomeMese = prossimoMese.toLocaleDateString("it-IT", { month: "long" });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">I miei turni</h1>
          <p className="text-sm text-muted">Due settimane da lunedì {new Date(lunedi(oggiRome()) + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long" })}</p>
        </div>
        <Link href="/profilo" className="text-[13px] font-medium underline-offset-2 hover:underline">Disponibilità</Link>
      </div>

      {dettaglio ? <ProssimoTurno t={dettaglio} /> : (
        <Card><p className="text-[13px] leading-[1.5] text-muted">Nessun turno in programma. Quando arriva la bozza del mese, i tuoi turni compaiono qui.</p></Card>
      )}

      <div className="flex flex-col gap-2">
        <H2>Prossime due settimane</H2>
        {(settimana ?? []).length === 0 ? (
          <Card><p className="text-[13px] text-muted">Nessun turno assegnato in questo periodo.</p></Card>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-xl border border-border">
            {(settimana ?? []).map((t) => {
              const oggi = t.giorno === oggiRome();
              const parte = PARTE.includes(t.stato_turno);
              return (
                <div key={t.turno_id} className={`flex min-h-14 items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 ${oggi ? "bg-accent-soft" : "bg-card"}`}>
                  <span className="flex w-11 flex-col items-center leading-[1.1]">
                    <small className={`text-[11px] uppercase ${oggi ? "text-accent-fg" : "text-muted"}`}>{new Date(t.giorno + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short" })}</small>
                    <b className={`text-lg ${oggi ? "text-accent-fg" : ""}`}>{new Date(t.giorno + "T12:00:00").getDate()}</b>
                  </span>
                  <span className="flex-1 text-sm">
                    <span className="font-semibold">{t.ruolo === "backup" ? "Backup" : "Turno"} · {t.linea_nome}</span>
                    {t.stato_mio === "non_viene" && <span className="text-muted"> · hai avvisato</span>}
                    {t.stato_mio === "copre" && <span className="text-muted"> · copri tu</span>}
                    {!parte && <span className="text-danger"> · {ETICHETTA[t.stato_turno]}</span>}
                  </span>
                  <Badge tone={t.ruolo === "backup" ? "muted" : "dark"}>{t.ruolo === "backup" ? "riserva" : hhmm(t.ora_partenza)}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Alert icon={<Calendar size={16} />} title={`${nomeMese.charAt(0).toUpperCase() + nomeMese.slice(1)}`}>
        {bozza && bozza.stato !== "pubblicata" ? (
          <>La bozza dei turni è arrivata{bozza.inviata_il ? ` il ${quando(bozza.inviata_il)}` : ""}: chi non risponde{bozza.scadenza_silenzio_assenso ? ` entro il ${new Date(bozza.scadenza_silenzio_assenso + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long" })}` : ""} conferma per silenzio-assenso. </>
        ) : (
          <>La bozza dei turni arriva alla fine del mese. Chi non risponde entro la scadenza conferma per silenzio-assenso. </>
        )}
        {(eccezioni ?? []).length ? `Hai ${eccezioni!.length} ${eccezioni!.length > 1 ? "eccezioni segnate" : "eccezione segnata"}. ` : "Un giorno diverso dal solito? Segnalo prima della bozza. "}
        <Link href="/profilo#eccezioni" className="font-semibold underline-offset-2 hover:underline">Eccezioni</Link>
      </Alert>
    </div>
  );
}

function lunedi(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}
function aggiungi(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);
}
