"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Calendar, Check, MapPin, User, Users } from "lucide-react";
import type { RuoloTipo } from "@/lib/database.types";
import { cn } from "@/lib/utils";

type Voce = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; badge?: number | string };

export function BottomNav({ ruolo, nonLetti }: { ruolo: RuoloTipo; nonLetti: number }) {
  const pathname = usePathname();
  const avvisi: Voce = { href: "/avvisi", label: "Avvisi", icon: Bell, badge: nonLetti || undefined };
  const profilo: Voce = { href: "/profilo", label: "Profilo", icon: User };
  const voci: Voce[] =
    ruolo === "genitore" ? [{ href: "/presenze", label: "Presenze", icon: Check }, avvisi, profilo]
    : ruolo === "volontario" ? [{ href: "/turni", label: "Turni", icon: Calendar }, { href: "/appello", label: "Appello", icon: Check }, avvisi, profilo]
    : [{ href: "/oggi", label: "Oggi", icon: Check }, { href: "/iscrizioni", label: "Iscrizioni", icon: Users }, { href: "/linee", label: "Linee", icon: MapPin }, { href: "/turni", label: "Turni", icon: Calendar }, avvisi];

  return (
    <nav
      aria-label="Sezioni"
      className="sticky bottom-0 grid border-t border-border bg-card px-2 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))]"
      style={{ gridTemplateColumns: `repeat(${voci.length}, minmax(0, 1fr))` }}
    >
      {voci.map(({ href, label, icon: Icon, badge }) => {
        const on = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={cn("relative flex min-h-12 flex-col items-center justify-center gap-[3px] py-1.5 text-[11px] font-medium text-muted", on && "font-semibold text-accent")}>
            <Icon size={22} />
            {label}
            {badge ? (
              <span className="absolute top-0.5 left-[calc(50%+6px)] flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
