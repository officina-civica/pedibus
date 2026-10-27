import { Hammer } from "lucide-react";
import { Card } from "@/components/ui/card";

/* Segnaposto per le schermate che arrivano dopo: l'ordine è genitore → volontario → amministratore. */
export function InCostruzione({ titolo, sotto, cosa }: { titolo: string; sotto?: string; cosa: string[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">{titolo}</h1>
        {sotto && <p className="text-sm text-muted">{sotto}</p>}
      </div>
      <Card>
        <div className="flex items-center gap-2 font-semibold"><Hammer size={16} /> In costruzione</div>
        <p className="text-[13px] leading-[1.5] text-muted">Questa schermata arriva nel prossimo passo. Nel prototipo è già disegnata; qui mostrerà:</p>
        <ul className="list-disc pl-5 text-[13px] leading-[1.6] text-muted">{cosa.map((c) => <li key={c}>{c}</li>)}</ul>
      </Card>
    </div>
  );
}
