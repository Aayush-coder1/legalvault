import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-white/10 bg-white/5 text-zinc-300",
        open: "border-blue-400/20 bg-blue-500/10 text-blue-300",
        progress: "border-amber-400/20 bg-amber-500/10 text-amber-300",
        closed: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
        outline: "border-white/15 bg-transparent text-zinc-300",
        gold: "border-[#e3b341]/25 bg-[#e3b341]/10 text-[#e3b341]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/** Status dot + label badge for case states. */
export function StatusBadge({ status }: { status: "open" | "in-progress" | "closed" }) {
  const variant = status === "open" ? "open" : status === "in-progress" ? "progress" : "closed";
  const label = status === "open" ? "Open" : status === "in-progress" ? "In progress" : "Closed";
  return (
    <Badge variant={variant}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  );
}
