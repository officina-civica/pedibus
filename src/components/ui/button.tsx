import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-45 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg border-primary",
        outline: "bg-card text-fg border-border",
        danger: "bg-card text-danger border-danger-line",
        dashed: "bg-card text-fg border-dashed border-border font-medium",
        ghost: "bg-transparent text-fg",
      },
      size: {
        md: "min-h-12 px-4 text-[15px]",
        lg: "min-h-14 px-4 text-base",
        sm: "min-h-10 px-3 text-[13px]",
        icon: "h-11 w-11 p-0",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, block, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

export { buttonVariants };
