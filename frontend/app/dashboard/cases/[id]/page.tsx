"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { CaseDetailView } from "@/components/cases/case-detail-view";
import { ROUTES } from "@/lib/config/constants";

/** Server title is generic; detail view loads the live case itself. */
export default function CaseDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader title="Case detail" subtitle={id} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <Link
          href={ROUTES.dashboard}
          className="mb-4 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-zinc-400 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Back to cases
        </Link>
        <CaseDetailView caseId={id} />
      </main>
    </div>
  );
}
