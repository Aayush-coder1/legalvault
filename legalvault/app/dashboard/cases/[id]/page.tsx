import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { CaseDetailView } from "@/components/cases/case-detail-view";
import { getMockCase, getMockEvidence } from "@/lib/mock-data";
import { ROUTES } from "@/lib/config/constants";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legalCase = getMockCase(id);
  return { title: legalCase ? legalCase.title : "Case not found" };
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legalCase = getMockCase(id);
  if (!legalCase) notFound();

  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader title={legalCase.title} subtitle={legalCase.caseNumber} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <Link
          href={ROUTES.dashboard}
          className="mb-4 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-gray-600 outline-none transition-colors hover:text-gray-950 focus-visible:ring-2 focus-visible:ring-gray-950"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Back to cases
        </Link>
        <CaseDetailView initialCase={legalCase} initialEvidence={getMockEvidence(legalCase.id)} />
      </main>
    </div>
  );
}
