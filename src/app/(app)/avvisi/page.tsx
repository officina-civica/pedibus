import type { Metadata } from "next";
import { Bell, Check, MessageSquare, TriangleAlert } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { quando } from "@/lib/date";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SegnaLetti } from "./segna-letti";

export const metadata: Metadata = { title: "Avvisi" };

export default async function AvvisiPage() {
  const supabase = await supabaseServer();
  const { data: avvisi } = await supabase.from("avvisi").select("*").order("creato_il", { ascending: false }).limit(100);
  const lista = avvisi ?? [];
  const nonLetti = lista.some((a) => !a.letto_il);

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">Avvisi</h1>
        <p className="text-sm text-muted">{lista.length ? `${lista.length} avvisi` : "Nessun avviso per ora"}</p>
      </div>
      {nonLetti && <SegnaLetti />}
      {lista.length === 0 ? (
        <Card><p className="text-[13px] leading-[1.5] text-muted">Gli avvisi arrivano come notifiche push sul telefono. Qui restano in archivio. Quelli urgenti arrivano anche via SMS.</p></Card>
      ) : (
        <div>
          {lista.map((a) => (
            <div key={a.id} className="flex items-start gap-2.5 border-b border-border py-3 last:border-b-0">
              <span className="mt-0.5 shrink-0">{a.tipo === "warn" ? <TriangleAlert size={18} /> : a.tipo === "ok" ? <Check size={18} /> : <Bell size={18} />}</span>
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${a.letto_il ? "font-semibold" : "font-bold"}`}>{a.titolo}</div>
                <div className="text-[13px] leading-[1.45] text-muted">{a.corpo}</div>
                {a.sms && <div className="mt-1"><Badge tone="muted"><MessageSquare size={12} /> anche via SMS</Badge></div>}
              </div>
              <span className="tabular shrink-0 pt-0.5 text-[11px] text-muted">{quando(a.creato_il)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
