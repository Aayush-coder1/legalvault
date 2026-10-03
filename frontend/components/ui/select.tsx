import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100",
        "outline-none transition-colors focus:border-white/30 focus:ring-2 focus:ring-white/10",
        "disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-zinc-900",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
