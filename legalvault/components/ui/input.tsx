import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Input({ className, type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400",
        "outline-none transition-colors focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10",
        "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
        className,
      )}
      {...props}
    />
  );
}
