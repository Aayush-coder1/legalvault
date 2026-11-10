"use client";

import * as React from "react";
import { Box, Briefcase, Database, FileText, KeyRound, LockKeyhole, Monitor, Network, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  BASE_EDGES,
  BASE_EDGE_KEYS,
  CANVAS_H,
  CANVAS_W,
  NODES,
  NODE_BY_ID,
  NODE_H,
  NODE_W,
  bezierPoint,
  edgeGeometry,
  edgeKey,
  type EdgeGeometry,
  type TopologyNode,
} from "@/lib/telemetry/topology";
import type { EdgeEvent, NodeId, ServiceHealth, TelemetryStats } from "@/lib/telemetry/types";
import type { TrafficListener } from "@/lib/telemetry/use-telemetry-stream";
import { fmtMs, fmtRate } from "./format";

const ICONS: Record<NodeId, LucideIcon> = {
  client: Monitor,
  "api-gateway": Network,
  "auth-service": KeyRound,
  "case-service": Briefcase,
  "file-service": FileText,
  "crypto-proxy": LockKeyhole,
  mongodb: Database,
  b2: Box,
};

const KIND_ACCENT: Record<TopologyNode["kind"], string> = {
  client: "border-violet-400/50 bg-violet-500/[0.07]",
  gateway: "border-sky-400/40 bg-sky-500/[0.05]",
  service: "border-sky-400/40 bg-sky-500/[0.05]",
  crypto: "border-[#e3b341]/50 bg-[#e3b341]/[0.06]",
  db: "border-teal-400/50 bg-teal-500/[0.06]",
  store: "border-teal-400/50 bg-teal-500/[0.06]",
};

const MAX_PARTICLES = 600;

interface Particle {
  g: EdgeGeometry;
  start: number;
  dur: number;
  color: string;
  r: number;
  to: NodeId;
  arrived: boolean;
}

interface Ripple {
  x: number;
  y: number;
  start: number;
  color: string;
}

function statusColor(status: number) {
  if (status === 0 || status >= 500) return "#f87171";
  if (status >= 400) return "#fbbf24";
  return "#5eead4";
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <svg className="h-5 w-16" aria-hidden />;
  const max = Math.max(1, ...values);
  const w = 64;
  const h = 20;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-5 w-16" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function healthOf(id: NodeId, stats: TelemetryStats | null): ServiceHealth["status"] | "idle" | "ok" | "errors" {
  const h = stats?.health?.[id];
  if (h) return h.status;
  const n = stats?.nodes?.[id];
  if (!n || n.count === 0) return "idle";
  return n.serverErrorRate > 20 ? "errors" : "ok";
}

const DOT: Record<string, string> = {
  up: "bg-emerald-400",
  ok: "bg-emerald-400",
  down: "bg-red-500",
  errors: "bg-red-500",
  disabled: "bg-zinc-600",
  unknown: "bg-zinc-600",
  idle: "bg-zinc-600",
};

function NodeCard({ node, stats, history }: { node: TopologyNode; stats: TelemetryStats | null; history: number[] }) {
  const Icon = ICONS[node.id];
  const s = stats?.nodes?.[node.id];
  const health = healthOf(node.id, stats);
  const hErr = stats?.health?.[node.id]?.error;
  const err = s?.errorRate ?? 0;
  const serverErr = s?.serverErrorRate ?? 0;
  // Red = the service is failing (5xx / unreachable). Amber = callers are
  // getting many 4xx (bad tokens, not found) — usually a client problem.
  const tone =
    health === "down"
      ? "border-red-500/70 bg-red-500/[0.08]"
      : serverErr >= 10
        ? "border-red-400/60"
        : err >= 20 || serverErr > 0
          ? "border-amber-400/60"
          : KIND_ACCENT[node.kind];
  return (
    <div
      className={cn(
        "absolute flex flex-col justify-between rounded-lg border px-2.5 py-2 shadow-lg shadow-black/40 backdrop-blur-sm transition-colors",
        tone,
      )}
      style={{
        left: `${(node.x / CANVAS_W) * 100}%`,
        top: `${(node.y / CANVAS_H) * 100}%`,
        width: `${(NODE_W / CANVAS_W) * 100}%`,
        height: `${(NODE_H / CANVAS_H) * 100}%`,
      }}
      title={hErr ? `${node.label}: ${hErr}` : node.label}
      data-node={node.id}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-zinc-300" aria-hidden />
        <span className="truncate text-[12px] font-semibold text-white">{node.label}</span>
        <span className="truncate text-[10px] text-zinc-500">{node.sub}</span>
        <span className={cn("ml-auto size-2 shrink-0 rounded-full", DOT[health] || "bg-zinc-600")} aria-label={`status ${health}`} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="leading-none">
          <span className="font-mono text-[17px] font-semibold text-white tabular-nums">{fmtRate(s?.rps ?? 0)}</span>
          <span className="ml-1 text-[10px] font-semibold tracking-wide text-sky-300">{node.id === "client" ? "SENT" : "IN"}</span>
        </div>
        <span className="text-sky-300/70">
          <Sparkline values={history} />
        </span>
      </div>
      <div className="flex items-center justify-between font-mono text-[10.5px] text-zinc-400 tabular-nums">
        <span>
          {fmtMs(s?.p99 ?? 0)} <span className="text-zinc-500">P99</span>
        </span>
        <span
          className={cn(serverErr >= 10 ? "text-red-400" : err >= 5 ? "text-amber-300" : "text-zinc-400")}
          title={`4xx ${s?.err4xx ?? 0} · 5xx ${s?.err5xx ?? 0}`}
        >
          {err.toFixed(err >= 10 || err === 0 ? 0 : 1)}% <span className="text-zinc-500">ERR</span>
        </span>
      </div>
      {health === "down" ? (
        <span className="absolute -bottom-2 left-2 rounded bg-red-500 px-1.5 text-[9.5px] font-semibold text-white">
          UNREACHABLE
        </span>
      ) : null}
    </div>
  );
}

export interface TopologyGraphProps {
  stats: TelemetryStats | null;
  history: Partial<Record<NodeId, number[]>>;
  onTraffic: (fn: TrafficListener) => () => void;
  paused: boolean;
  pollMs?: number;
}

export function TopologyGraph({ stats, history, onTraffic, paused, pollMs = 1000 }: TopologyGraphProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const particles = React.useRef<Particle[]>([]);
  const ripples = React.useRef<Ripple[]>([]);
  const pausedRef = React.useRef(paused);
  const geoCache = React.useRef(new Map<string, EdgeGeometry>());

  React.useEffect(() => {
    pausedRef.current = paused;
    if (paused) {
      particles.current = [];
      ripples.current = [];
    }
  }, [paused]);

  const geo = React.useCallback((from: NodeId, to: NodeId) => {
    const k = edgeKey(from, to);
    let g = geoCache.current.get(k);
    if (!g) {
      g = edgeGeometry(from, to);
      geoCache.current.set(k, g);
    }
    return g;
  }, []);

  // Spawn one particle per request hop, keeping the real ordering and
  // spacing of the batch (events arrive in ~1s batches from the gateway).
  React.useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return onTraffic((events: EdgeEvent[]) => {
      if (pausedRef.current || reduced) return;
      const now = performance.now();
      const t0 = Math.min(...events.map((e) => e.ts));
      for (const e of events) {
        if (!NODE_BY_ID[e.from] || !NODE_BY_ID[e.to]) continue;
        const delay = Math.min(pollMs, Math.max(0, e.ts - t0));
        particles.current.push({
          g: geo(e.from, e.to),
          start: now + delay,
          dur: 650 + 260 * Math.log10(1 + Math.max(0, e.ms || 0)),
          color: statusColor(e.status),
          r: 2.2 + Math.min(3, Math.log10(1 + (e.bytes || 0)) / 2),
          to: e.to,
          arrived: false,
        });
      }
      if (particles.current.length > MAX_PARTICLES) {
        particles.current.splice(0, particles.current.length - MAX_PARTICLES);
      }
    });
  }, [onTraffic, geo, pollMs]);

  // Canvas render loop.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform((dpr * w) / CANVAS_W, 0, 0, (dpr * h) / CANVAS_H, 0, 0);

      const live: Particle[] = [];
      for (const p of particles.current) {
        const t = (now - p.start) / p.dur;
        if (t < 0) {
          live.push(p);
          continue;
        }
        if (t >= 1) {
          if (!p.arrived) {
            p.arrived = true;
            ripples.current.push({ x: p.g.p3.x, y: p.g.p3.y, start: now, color: p.color });
          }
          continue;
        }
        live.push(p);
        const pt = bezierPoint(p.g, t);
        const tail = bezierPoint(p.g, Math.max(0, t - 0.06));
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = p.r;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      particles.current = live;

      ripples.current = ripples.current.filter((rp) => {
        const t = (now - rp.start) / 450;
        if (t >= 1) return false;
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = rp.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, 3 + t * 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return true;
      });
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Extra edges seen in live traffic but not in the design (e.g. JWKS key
  // fetches case -> auth, or the browser calling services directly in local dev).
  const dynamicEdges = React.useMemo(() => {
    const keys = Object.keys(stats?.edges || {});
    return keys
      .filter((k) => !BASE_EDGE_KEYS.has(k))
      .map((k) => k.split("->") as [NodeId, NodeId])
      .filter(([a, b]) => NODE_BY_ID[a] && NODE_BY_ID[b] && a !== b);
  }, [stats]);

  return (
    <div className="w-full max-w-full min-h-[400px]">
      <div ref={wrapRef} className="relative w-full max-w-full" style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}>
        <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <pattern id="lv-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.07)" />
            </pattern>
            <marker id="lv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(161,161,170,0.7)" />
            </marker>
          </defs>
          <rect width={CANVAS_W} height={CANVAS_H} fill="url(#lv-grid)" />
          {BASE_EDGES.map(([a, b]) => {
            const g = edgeGeometry(a, b);
            const es = stats?.edges?.[edgeKey(a, b)];
            const active = (es?.rps ?? 0) > 0;
            const bad = (es?.serverErrorRate ?? 0) >= 10;
            const warn = !bad && (es?.errorRate ?? 0) >= 20;
            return (
              <g key={edgeKey(a, b)}>
                <path
                  d={g.d}
                  fill="none"
                  stroke={
                    bad
                      ? "rgba(248,113,113,0.65)"
                      : warn
                        ? "rgba(251,191,36,0.55)"
                        : active
                          ? "rgba(212,212,216,0.55)"
                          : "rgba(113,113,122,0.45)"
                  }
                  strokeWidth={active ? 1.8 : 1.3}
                  strokeDasharray="6 4"
                  markerEnd="url(#lv-arrow)"
                />
                {active ? (
                  <text x={g.mid.x + 6} y={g.mid.y - 6} className="fill-zinc-400 font-mono" fontSize="11">
                    {fmtRate(es!.rps)}
                  </text>
                ) : null}
              </g>
            );
          })}
          {dynamicEdges.map(([a, b]) => {
            const g = edgeGeometry(a, b);
            const es = stats?.edges?.[edgeKey(a, b)];
            return (
              <g key={edgeKey(a, b)}>
                <path d={g.d} fill="none" stroke="rgba(167,139,250,0.45)" strokeWidth={1.2} strokeDasharray="2 4" />
                {(es?.rps ?? 0) > 0 ? (
                  <text x={g.mid.x + 6} y={g.mid.y + 12} className="fill-violet-300/70 font-mono" fontSize="10">
                    {fmtRate(es!.rps)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" aria-hidden />
        {NODES.map((n) => (
          <NodeCard key={n.id} node={n} stats={stats} history={history[n.id] || []} />
        ))}
      </div>
    </div>
  );
}
