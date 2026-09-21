import { cn } from "@/lib/utils/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-950",
        className,
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-gray-100", className)} />;
}

/** Placeholder list shown while case data loads (matches CaseCard layout). */
export function CaseListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/3" />
          <Skeleton className="mt-3 h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
