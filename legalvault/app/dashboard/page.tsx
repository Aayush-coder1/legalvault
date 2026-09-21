import type { Metadata } from "next";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { CasesView } from "@/components/cases/cases-view";
import { mockCases } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader title="Cases" subtitle="All matters in your workspace" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <CasesView initialCases={mockCases} />
      </main>
    </div>
  );
}
