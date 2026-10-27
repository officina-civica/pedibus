import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-semibold", {
  variants: {
    tone: {
      ok: "border border-ok-line bg-ok-soft text-ok-fg",
      accent: "bg-accent-soft text-accent-fg",
      muted: "bg-muted-bg text-fg",
      danger: "bg-danger-soft text-danger",
      dark: "bg-primary text-primary-fg",
    },
  },
  defaultVariants: { tone: "muted" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
