import Link from "next/link";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { APP_NAME } from "@/lib/config/constants";

export function Brand({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label={`${APP_NAME} home`}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-gray-950 text-white">
        <Scale className="size-4" aria-hidden />
      </span>
      {!compact && <span className="text-[15px] font-semibold tracking-tight text-gray-950">{APP_NAME}</span>}
    </Link>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-8 items-center justify-center rounded-lg bg-gray-950 text-white", className)}>
      <Scale className="size-4" aria-hidden />
    </span>
  );
}
