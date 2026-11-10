"use client";

import { usePublicTelemetryStream } from "@/lib/telemetry/use-telemetry-stream";
import { SystemTopologyView } from "@/components/topology/system-topology-view";

/**
 * Public system-topology simulator shell. No session required: reads the
 * gateway's telemetry SSE stream with plain fetch
 * (TELEMETRY_REQUIRE_AUTH=false on the gateway).
 */
export function SimulatorClient() {
  const stream = usePublicTelemetryStream();

  return (
    <div className="flex min-h-full flex-col bg-zinc-950 text-zinc-200">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10 px-3 py-2 sm:px-4">
        <div className="mx-auto w-full max-w-[1100px] flex justify-between gap-3 px-3 sm:px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-semibold text-white tracking-tight uppercase">
              LegalVault Simulator
            </h1>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-3 py-2 sm:px-4 lg:px-6">
        <SystemTopologyView stream={stream} hideMetrics hideStatus />
      </main>
    </div>
  );
}
