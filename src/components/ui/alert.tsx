import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex items-start gap-2.5 rounded-xl border px-3.5 py-3", {
  variants: {
    tone: {
      neutral: "border-border bg-muted-bg text-fg",
      warn: "border-accent-line bg-accent-soft text-accent-fg",
      ok: "border-ok-line bg-ok-soft text-ok-fg",
      danger: "border-danger-line bg-danger-soft text-danger",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Alert({ className, tone, icon, title, children, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & { icon?: React.ReactNode; title?: React.ReactNode }) {
  return (
    <div role="status" className={cn(alertVariants({ tone }), className)} {...props}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <b className="font-bold">{title}</b>}
        {children && <span className="text-[13px] leading-[1.45]">{children}</span>}
      </div>
    </div>
  );
}
