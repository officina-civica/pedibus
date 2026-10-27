import { BriefcaseMedical, TriangleAlert } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { getSessione } from "@/lib/sessione";
import { giornoLungo, hhmm, oggiODomani, oggiRome } from "@/lib/date";
import { turnoParte, ETICHETTA_TURNO } from "@/lib/turni";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Avatar, H2 } from "@/components/blocchi";
import { Badge } from "@/components/ui/badge";
import { iniziali } from "@/lib/utils";
import { BozzaMese } from "./bozza-mese";

/* Turni visti dall'amministratore: i team del giorno di riferimento e la bozza del mese. */
export async function TurnoAdmin() {
  const s = await getSessione();
  const supabase = await supabaseServer();
  const { data: giorno } = await supabase.rpc("mio_giorno_riferimento", {});
  const g = giorno ?? oggiRome();
  const [{ data: turni }, { data: bozze }, { data: eccezioni }] = await Promise.all([
    supabase.rpc("turni_del_giorno", { p_giorno: g }),
    supabase.from("bozze_turni").select("*").order("mese", { ascending: false }).limit(1),
    supabase.from("eccezioni_disponibilita").select("volontario_id, giorno, tipo").gte("giorno", oggiRome()),
  ]);
  const bozza = bozze?.[0] ?? null;
  const prossimoMese = new Date(oggiRome().slice(0, 7) + "-01T12:00:00"); prossimoMese.setMonth(prossimoMese.getMonth() + 1);
  const meseIso = prossimoMese.toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">Turni</h1>
        <p className="text-sm text-muted-foreground">{oggiODomani(g) === "oggi" ? "Oggi" : "Domani"}, {giornoLungo(g).toLowerCase()}</p>
      </div>

      {(turni ?? []).length === 0 && <Card size="sm" className="px-3"><p className="text-[13px] text-muted-foreground">Nessun turno per questo giorno: genera la bozza del mese.</p></Card>}
      {(turni ?? []).map((t) => (
        <Card key={t.id} size="sm" className="px-3">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ background: t.linea.colore }} /><b>{t.linea.nome} · {hhmm(t.linea.ora_partenza)}</b></div>
            <Badge variant={turnoParte(t.stato) ? "success" : "destructive"}>{turnoParte(t.stato) ? "parte" : "annullata"}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            {t.volontari.map((v) => (
              <div key={v.id} className="flex items-center gap-2">
                <Avatar size="sm">{iniziali(v.nome)}</Avatar>
                <span className={`flex-1 ${v.stato === "non_viene" ? "text-muted-foreground line-through" : v.ruolo === "backup" ? "text-muted-foreground" : ""}`}>{v.nome}{v.ruolo === "backup" ? " · backup" : ""}</span>
                {v.kit && v.stato !== "non_viene" && <Badge variant="success"><BriefcaseMedical size={12} /> kit</Badge>}
                {v.stato === "non_viene" && <Badge variant="destructive">non viene</Badge>}
                {v.stato === "copre" && <Badge variant="brand">copre il turno</Badge>}
              </div>
            ))}
            {t.volontari.length === 0 && <span className="text-[13px] text-muted-foreground">Nessun volontario assegnato.</span>}
          </div>
          <div className="text-[13px] text-muted-foreground">
            {t.copertura} su {t.linea.min_volontari} · {t.kit_presente ? "kit presente" : <span className="text-brand">nessun kit: la sostituzione lo segnala</span>}
            {!turnoParte(t.stato) && ` · ${ETICHETTA_TURNO[t.stato]}`}
          </div>
          {t.escalation_dal && t.copertura < t.linea.min_volontari && turnoParte(t.stato) && (
            <Alert variant="warning"><TriangleAlert /><AlertTitle>Turno scoperto</AlertTitle><AlertDescription>Backup avvisati{t.escalation_allargata_il ? ", poi tutti i volontari" : ""}. Se nessuno copre, tocca a te chiamare qualcuno.</AlertDescription></Alert>
          )}
        </Card>
      ))}

      <div className="flex flex-col gap-2">
        <H2>{prossimoMese.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</H2>
        <BozzaMese bozza={bozza} scuolaId={s.scuolaId!} meseIso={meseIso} eccezioni={(eccezioni ?? []).length} />
      </div>
    </div>
  );
}
