import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, accent, ...props }: React.HTMLAttributes<HTMLDivElement> & { accent?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5",
        accent && "border-accent-line border-l-4 border-l-accent",
        className,
      )}
      {...props}
    />
  );
}

export function Rows({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col overflow-hidden rounded-xl border border-border", className)} {...props} />;
}

export function Row({ className, muted, ...props }: React.HTMLAttributes<HTMLDivElement> & { muted?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-16 items-center gap-3 border-b border-border bg-card px-3 py-2.5 last:border-b-0",
        muted && "bg-muted-bg",
        className,
      )}
      {...props}
    />
  );
}

export function H2({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-xs font-semibold uppercase tracking-[.05em] text-muted", className)} {...props} />;
}

export function Avatar({ children, accent, size = "md", className }: { children: React.ReactNode; accent?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted-bg font-semibold text-fg",
        size === "sm" && "h-7 w-7 text-[11px]",
        size === "md" && "h-10 w-10 text-sm",
        size === "lg" && "h-13 w-13 text-lg",
        accent && "bg-accent-soft text-accent-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}
