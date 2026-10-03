import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Input({ className, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 placeholder:text-zinc-600",
        "outline-none transition-colors focus:border-white/30 focus:ring-2 focus:ring-white/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
