import Link from "next/link";
import { Paperclip } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ROUTES } from "@/lib/config/constants";
import { formatDate } from "@/lib/utils/format";
import type { LegalCase } from "@/lib/types";

export function CaseCard({ legalCase, evidenceCount }: { legalCase: LegalCase; evidenceCount?: number }) {
  return (
    <Link
      href={ROUTES.caseDetail(legalCase.id)}
      className="block rounded-xl outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2"
    >
      <Card className="p-5 transition-colors hover:border-gray-300">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-gray-950">{legalCase.title}</h3>
            <p className="mt-0.5 font-mono text-xs text-gray-500">{legalCase.caseNumber}</p>
          </div>
          <StatusBadge status={legalCase.status} />
        </div>
        <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-gray-600">{legalCase.description}</p>
        <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
          <span>Created {formatDate(legalCase.createdAt)}</span>
          {typeof evidenceCount === "number" ? (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="size-3.5" aria-hidden />
              {evidenceCount} file{evidenceCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
