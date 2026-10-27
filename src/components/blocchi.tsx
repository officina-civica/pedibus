import * as React from "react";
import { cn } from "@/lib/utils";

/*
  Mattoni dell'app che non sono componenti shadcn: un'etichetta di sezione,
  un elenco di righe, l'avatar con le iniziali. Costruiti sui token del tema.
*/

export function H2({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-xs font-semibold uppercase tracking-[.05em] text-muted-foreground", className)} {...props} />;
}

export function Rows({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col overflow-hidden rounded-xl border", className)} {...props} />;
}

export function Row({ className, muted, ...props }: React.ComponentProps<"div"> & { muted?: boolean }) {
  return (
    <div
      className={cn("flex min-h-16 items-center gap-3 border-b bg-card px-3 py-2.5 last:border-b-0", muted && "bg-muted", className)}
      {...props}
    />
  );
}

export function Avatar({ children, accent, size = "md", className }: { children: React.ReactNode; accent?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground",
        size === "sm" && "h-7 w-7 text-[11px]",
        size === "md" && "h-10 w-10 text-sm",
        size === "lg" && "h-13 w-13 text-lg",
        accent && "bg-brand/10 text-brand",
        className,
      )}
    >
      {children}
    </span>
  );
}
