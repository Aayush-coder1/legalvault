import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-gray-200 bg-gray-50 text-gray-700",
        open: "border-blue-200 bg-blue-50 text-blue-800",
        progress: "border-amber-200 bg-amber-50 text-amber-800",
        closed: "border-emerald-200 bg-emerald-50 text-emerald-800",
        outline: "border-gray-300 bg-white text-gray-700",
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
