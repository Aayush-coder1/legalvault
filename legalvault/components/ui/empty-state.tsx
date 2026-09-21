import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-gray-950">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-[13px] text-gray-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
