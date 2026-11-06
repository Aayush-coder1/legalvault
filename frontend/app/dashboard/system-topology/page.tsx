import type { Metadata } from "next";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { SystemTopologyView } from "@/components/topology/system-topology-view";

export const metadata: Metadata = { title: "System topology" };

/** Live microservice request tracker (data: gateway /api/v1/telemetry/stream). */
export default function SystemTopologyPage() {
  return (
    <div className="flex min-h-full flex-col">
      <DashboardHeader title="System topology" subtitle="Live request flow across LegalVault services" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <SystemTopologyView />
      </main>
    </div>
  );
}
