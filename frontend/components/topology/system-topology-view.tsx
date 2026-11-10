"use client";

import * as React from "react";
import { Activity, ExternalLink, Gauge, LockKeyhole, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import { BREAKSCALE_ORIGINAL_DESIGN, buildCalibratedBreakscaleUrl } from "@/lib/telemetry/breakscale";
import { NODE_BY_ID } from "@/lib/telemetry/topology";
import type { EdgeEvent, NodeId, StreamStatus } from "@/lib/telemetry/types";
import { GATEWAY_URL, type TelemetryStreamState, useTelemetryStream } from "@/lib/telemetry/use-telemetry-stream";
import { TopologyGraph } from "./topology-graph";
import { fmtBytesPerSec, fmtClock, fmtMs, fmtPct, fmtRate } from "./format";

const STATUS_LABEL: Record<StreamStatus, { text: string; cls: string }> = {
  connecting: { text: "Connecting…", cls: "border-white/10 bg-white/5 text-zinc-300" },
  live: { text: "Live", cls: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" },
  reconnecting: { text: "Reconnecting…", cls: "border-amber-400/30 bg-amber-500/10 text-amber-300" },
  unauthorized: { text: "Session expired", cls: "border-red-400/30 bg-red-500/10 text-red-300" },
  error: { text: "Offline", cls: "border-red-400/30 bg-red-500/10 text-red-300" },
};

const SERVICES: NodeId[] = ["api-gateway", "auth-service", "case-service", "file-service", "crypto-proxy"];

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: React.ReactNode;
  tone?: "default" | "warn" | "bad";
}) {
  return (
    <Card className={cn(tone === "bad" && "border-red-400/30", tone === "warn" && "border-amber-400/30")}>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-[12px] font-medium tracking-wide text-zinc-400 uppercase">
          <Icon className="size-3.5" aria-hidden />
          {label}
        </div>
        <p
          className={cn(
            "mt-2 font-mono text-2xl font-semibold text-white tabular-nums",
            tone === "bad" && "text-red-300",
            tone === "warn" && "text-amber-200",
          )}
        >
          {value}
        </p>
        <p className="mt-1 text-[12px] text-zinc-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: number }) {
  const cls =
    status === 0 || status >= 500
      ? "bg-red-500/15 text-red-300"
      : status >= 400
        ? "bg-amber-500/15 text-amber-300"
        : "bg-emerald-500/15 text-emerald-300";
  return <span className={cn("rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums", cls)}>{status === 0 ? "ERR" : status}</span>;
}

function label(id: NodeId) {
  return NODE_BY_ID[id]?.label ?? id;
}

function RequestLog({ log }: { log: EdgeEvent[] }) {
  if (!log.length) {
    return (
      <p className="px-5 py-8 text-center text-[13px] text-zinc-500">
        No requests yet. Use LegalVault in another tab (log in, open a case, upload evidence) and they will appear here.
      </p>
    );
  }
  return (
    <div className="w-full">
      <table className="w-full text-left text-[12.5px]">
        <thead className="sticky top-0 bg-zinc-950/95 text-[11px] tracking-wide text-zinc-500 uppercase">
          <tr>
            <th className="px-5 py-2 font-medium">Time</th>
            <th className="px-2 py-2 font-medium">Hop</th>
            <th className="px-2 py-2 font-medium">Request</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-5 py-2 text-right font-medium">Latency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {log.map((e) => (
            <tr key={e.id} className="text-zinc-300">
              <td className="px-5 py-1.5 font-mono text-[11.5px] whitespace-nowrap text-zinc-500 tabular-nums">{fmtClock(e.ts)}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                {label(e.from)} <span className="text-zinc-600">→</span> {label(e.to)}
              </td>
              <td className="max-w-[260px] truncate px-2 py-1.5 font-mono text-[11.5px]" title={`${e.method} ${e.route}`}>
                <span className="text-zinc-500">{e.method}</span> {e.route}
              </td>
              <td className="px-2 py-1.5">
                <StatusPill status={e.status} />
              </td>
              <td className="px-5 py-1.5 text-right font-mono text-[11.5px] whitespace-nowrap tabular-nums">{fmtMs(e.ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SystemTopologyView({ stream, hideMetrics, hideStatus }: { stream?: TelemetryStreamState; hideMetrics?: boolean; hideStatus?: boolean } = {}) {
  const t = stream ?? useTelemetryStream(true);
  const [multiplier, setMultiplier] = React.useState("1");
  const { stats } = t;
  const g = stats?.global;
  const c = stats?.crypto;
  const status = STATUS_LABEL[t.status];

  const errorTone = (g?.serverErrorRate ?? 0) >= 5 ? "bad" : (g?.errorRate ?? 0) >= 5 ? "warn" : "default";

  function openBreakscale() {
    const { url } = buildCalibratedBreakscaleUrl(stats, { multiplier: Number(multiplier) });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const liveSamples = stats ? Object.values(stats.nodes).reduce((a, n) => a + (n?.count || 0), 0) : 0;

  return (
    <div className="space-y-3">
      {!hideStatus && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", status.cls)}>
            <span className={cn("size-1.5 rounded-full bg-current", t.status === "live" && "animate-pulse")} aria-hidden />
            {status.text}
          </span>
          {SERVICES.map((id) => {
            const h = stats?.health?.[id];
            const st = h?.status ?? "unknown";
            return (
              <Badge
                key={id}
                variant={st === "up" ? "closed" : st === "down" ? "outline" : "neutral"}
                className={cn(st === "down" && "border-red-400/30 text-red-300")}
                title={h?.error ? `${id}: ${h.error}` : id}
              >
                {label(id)}
                <span className="text-[10px] opacity-70">{st}</span>
              </Badge>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            {t.status !== "live" && (
              <Button variant="outline" size="sm" onClick={t.reconnect}>
                <RefreshCw aria-hidden /> Retry
              </Button>
            )}
          </div>
        </div>
      )}

      {!hideStatus && t.error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t.error}</span>
        </div>
      )}

      {!hideMetrics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Activity}
            label="Requests / sec"
            value={fmtRate(g?.rps ?? 0)}
            hint={<>entry traffic · {fmtRate(g?.internalRps ?? 0)} incl. internal hops</>}
          />
          <MetricCard
            icon={Gauge}
            label="P95 latency"
            value={fmtMs(g?.p95 ?? 0)}
            hint={<>p50 {fmtMs(g?.p50 ?? 0)} · p99 {fmtMs(g?.p99 ?? 0)}</>}
            tone={(g?.p95 ?? 0) > 2000 ? "warn" : "default"}
          />
          <MetricCard
            icon={TriangleAlert}
            label="Error rate"
            value={fmtPct(g?.errorRate ?? 0)}
            hint={<>4xx {g?.err4xx ?? 0} · 5xx {g?.err5xx ?? 0} (last {Math.round((stats?.windowMs ?? 60000) / 1000)}s)</>}
            tone={errorTone}
          />
          <MetricCard
            icon={LockKeyhole}
            label="Crypto proxy load"
            value={fmtRate(c?.rps ?? 0)}
            hint={
              <>
                AES-256-GCM · {fmtBytesPerSec(c?.bytesPerSec ?? 0)} · ~{(c?.inFlight ?? 0).toFixed(1)} in flight · B2 {fmtRate(c?.b2Rps ?? 0)} · Mongo{" "}
                {fmtRate(c?.mongoRps ?? 0)}
              </>
            }
          />
        </div>
      )}

      {/* topology */}
      <Card className="overflow-hidden bg-zinc-950">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-2">
          <div>
            <CardTitle>Live request flow</CardTitle>
            {!hideStatus && (
              <CardDescription>
                Each dot is one real request hop. Teal = 2xx/3xx, amber = 4xx, red = 5xx or unreachable. Dotted violet lines are
                hops outside the original design (e.g. JWKS key fetches).
              </CardDescription>
            )}
          </div>
          {!hideStatus && (
            <span className="text-[12px] text-zinc-500">
              {liveSamples} hops in the last {Math.round((stats?.windowMs ?? 60000) / 1000)}s
              {t.lastEventAt && ` · last ${fmtClock(t.lastEventAt)}`}
            </span>
          )}
        </CardHeader>
        <CardContent className="px-2 pb-2 sm:px-2">
          <TopologyGraph stats={stats} history={t.history} onTraffic={t.onTraffic} paused={false} />
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Recent requests</CardTitle>
          </CardHeader>
          <RequestLog log={t.log} />
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>BreakScale simulation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={openBreakscale}>
              <ExternalLink aria-hidden /> Open in BreakScale
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
