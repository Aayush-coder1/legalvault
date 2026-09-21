import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400",
        "outline-none transition-colors focus:border-gray-950 focus:ring-2 focus:ring-gray-950/10",
        "disabled:cursor-not-allowed disabled:bg-gray-50",
        className,
      )}
      {...props}
    />
  );
}
