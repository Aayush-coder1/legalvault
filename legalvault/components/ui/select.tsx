import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-9 w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900",
        "outline-none transition-colors focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10",
        "disabled:cursor-not-allowed disabled:bg-gray-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
