import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      data-slot="label"
      className={cn("block text-[13px] font-medium text-zinc-200", className)}
      {...props}
    />
  );
}

/** Label + control + optional hint/error, for consistent form spacing. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-[13px] text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}
