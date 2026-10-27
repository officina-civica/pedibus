import type { Sessione } from "@/lib/sessione";
import type { RuoloTipo } from "@/lib/database.types";
import { cambiaRuolo } from "@/app/(app)/azioni";
import { Avatar } from "@/components/ui/card";
import { cn, iniziali } from "@/lib/utils";

const ETICHETTA: Record<RuoloTipo, string> = { genitore: "Genitore", volontario: "Volontario", admin: "Admin" };

/* In alto: chi sei e, se hai più ruoli, con quale stai usando l'app. */
export function TopBar({ sessione: s }: { sessione: Sessione }) {
  const ruoli = (["genitore", "volontario", "admin"] as RuoloTipo[]).filter((r) => s.ruoli.some((x) => x.ruolo === r));
  const nome = s.persona ? `${s.persona.nome} ${s.persona.cognome}`.trim() : "";
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2.5 border-b border-border bg-card px-4 py-2.5 pt-[max(10px,env(safe-area-inset-top))]">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar accent>{iniziali(nome || "P")}</Avatar>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{nome || "Pedibus"}</div>
          <div className="text-xs text-muted">{s.ruoloAttivo ? ETICHETTA[s.ruoloAttivo] : ""} · Pedibus Vedano</div>
        </div>
      </div>
      {ruoli.length > 1 && (
        <div className="flex gap-0.5 rounded-full bg-muted-bg p-[3px]" role="tablist" aria-label="Ruolo">
          {ruoli.map((r) => (
            <form key={r} action={cambiaRuolo.bind(null, r)}>
              <button
                type="submit"
                role="tab"
                aria-selected={s.ruoloAttivo === r}
                className={cn("min-h-9 rounded-full px-3 text-[13px] font-semibold text-muted", s.ruoloAttivo === r && "bg-card text-fg shadow-sm")}
              >
                {ETICHETTA[r]}
              </button>
            </form>
          ))}
        </div>
      )}
    </header>
  );
}
