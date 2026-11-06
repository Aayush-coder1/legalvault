/**
 * Build a breakscale.tech link whose design is the LegalVault topology,
 * calibrated with LIVE numbers measured by our telemetry.
 *
 * Why a link and not "streaming into BreakScale": BreakScale
 * (github.com/xevrion/breakscale, MIT) is a client-side discrete-event
 * simulator. It has no API for pushing live traffic into it; a design
 * travels entirely in the URL fragment. So the honest integration is:
 * our dashboard shows the real traffic, and this link opens the same
 * topology in BreakScale with every parameter taken from production:
 *   - client rate     = measured entry requests/sec (x a load multiplier)
 *   - service time    = measured median SELF time of each service
 *                       (its latency minus time spent waiting on downstreams)
 *   - error rate      = measured 5xx rate per service
 *   - gateway routing = measured share of traffic to auth / case / file
 *   - Mongo / B2 time = measured median command / object latency
 * Then you can drag the multiplier up and watch where LegalVault breaks.
 *
 * Format (read from BreakScale's src/share.ts): "#d2." + base64url(
 * 0x00 flag byte + UTF-8 JSON {nodes, edges, annotations}). "d2." links
 * carry readable JSON and BreakScale merges each node's config with its
 * kind defaults, so we only send what we measured. Every link is
 * validated by BreakScale's own isTopology() before it opens.
 *
 * Pure module (no React, no imports) so it is unit-testable in Node.
 */
import type { TelemetryStats } from "./types";

export const BREAKSCALE_ORIGIN = "https://breakscale.tech/";

/** The team's hand-made design (README link) — kept for comparison. */
export const BREAKSCALE_ORIGINAL_DESIGN = "https://breakscale.tech/?s=xtcZJPGSEuJYLg#k=aeI-Gssx8x7JSn1OVgb11w";

type Kind = "client" | "lb" | "service" | "db" | "objectstore";

interface BsNode {
  id: string;
  kind: Kind;
  label: string;
  x: number;
  y: number;
  config: Record<string, number>;
}

interface BsEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
}

/** Positions follow docs/breakscale-simulation.png. */
const LAYOUT: ReadonlyArray<{ id: string; kind: Kind; label: string; x: number; y: number }> = [
  { id: "client", kind: "client", label: "Browser/Next.js Client", x: 40, y: 80 },
  { id: "gateway", kind: "lb", label: "API gateway:4000", x: 40, y: 300 },
  { id: "auth", kind: "service", label: "Auth service:4001", x: 80, y: 540 },
  { id: "case", kind: "service", label: "Case service:4002", x: 340, y: 20 },
  { id: "file", kind: "service", label: "File service:4003", x: 350, y: 420 },
  { id: "crypto", kind: "service", label: "Crypto Proxy:4004", x: 580, y: 230 },
  { id: "b2", kind: "objectstore", label: "Backblaze B2 (S3)", x: 880, y: 120 },
  { id: "mongo", kind: "db", label: "MongoDB Atlas", x: 820, y: 540 },
];

const EDGES: ReadonlyArray<readonly [string, string]> = [
  ["client", "gateway"],
  ["gateway", "auth"],
  ["gateway", "case"],
  ["gateway", "file"],
  ["case", "crypto"],
  ["file", "crypto"],
  ["crypto", "b2"],
  ["crypto", "mongo"],
  ["auth", "mongo"],
];

/** Our telemetry node id for each BreakScale node id. */
const TELEMETRY_ID: Record<string, keyof TelemetryStats["nodes"]> = {
  client: "client",
  gateway: "api-gateway",
  auth: "auth-service",
  case: "case-service",
  file: "file-service",
  crypto: "crypto-proxy",
  b2: "b2",
  mongo: "mongodb",
};

/** Frontend request timeout (lib/api/client.ts DEFAULT_TIMEOUT_MS). */
const CLIENT_TIMEOUT_MS = 35000;

export interface CalibratedDesign {
  url: string;
  /** What was measured vs. what fell back to a default (shown in the UI). */
  calibration: Array<{ node: string; field: string; value: number; source: "live" | "default" }>;
  liveSamples: number;
}

function round(n: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encode a topology in BreakScale's "d2." (uncompressed JSON) link format. */
export function encodeD2(topology: { nodes: BsNode[]; edges: BsEdge[]; annotations?: unknown[] }): string {
  const json = new TextEncoder().encode(JSON.stringify(topology));
  const framed = new Uint8Array(json.length + 1);
  framed[0] = 0; // RAW flag: no deflate
  framed.set(json, 1);
  return `d2.${toBase64Url(framed)}`;
}

/** Inverse of encodeD2 (used by tests and for debugging a generated link). */
export function decodeD2(fragment: string): { nodes: BsNode[]; edges: BsEdge[]; annotations?: unknown[] } {
  const text = fragment.replace(/^#/, "");
  if (!text.startsWith("d2.")) throw new Error("not a d2 link");
  const bytes = fromBase64Url(text.slice(3));
  if (bytes[0] !== 0) throw new Error("unexpected compression flag");
  return JSON.parse(new TextDecoder().decode(bytes.subarray(1)));
}

/**
 * @param stats       latest stats snapshot from the gateway (or null)
 * @param multiplier  scale the measured client rate (1 = today's traffic)
 */
export function buildCalibratedBreakscaleUrl(
  stats: TelemetryStats | null,
  { multiplier = 1, now = new Date() }: { multiplier?: number; now?: Date } = {},
): CalibratedDesign {
  const calibration: CalibratedDesign["calibration"] = [];
  const nodes = stats?.nodes;
  const mult = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;

  const live = (bsId: string) => (nodes ? nodes[TELEMETRY_ID[bsId]] : undefined);

  function pick(node: string, field: string, value: number | null | undefined, fallback: number, min = 0) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      const v = round(Math.max(min, value));
      calibration.push({ node, field, value: v, source: "live" });
      return v;
    }
    calibration.push({ node, field, value: fallback, source: "default" });
    return fallback;
  }

  const bsNodes: BsNode[] = LAYOUT.map((n) => {
    const s = live(n.id);
    const config: Record<string, number> = {};
    if (n.kind === "client") {
      const rps = pick(n.label, "rps", s ? s.rps : 0, 1, 0.1);
      config.rps = round(rps * mult);
      config.timeoutMs = CLIENT_TIMEOUT_MS;
    } else if (n.kind === "lb") {
      config.serviceMs = pick(n.label, "serviceMs", s?.selfP50 ?? s?.p50, 0.5, 0.1);
    } else {
      // Services: self time (excludes downstream waits, which BreakScale
      // simulates itself). Mongo/B2 have no downstream: use their latency.
      const t = n.kind === "service" ? s?.selfP50 ?? s?.p50 : s?.p50;
      const defaults: Record<Kind, number> = { client: 0, lb: 0.5, service: 25, db: 30, objectstore: 90 };
      config.serviceMs = pick(n.label, "serviceMs", t, defaults[n.kind], 0.1);
      const errRate = s && s.count > 0 ? s.serverErrorRate / 100 : 0;
      config.errorRate = round(Math.min(0.95, Math.max(0, errRate)), 4);
      calibration.push({ node: n.label, field: "errorRate", value: config.errorRate, source: s && s.count > 0 ? "live" : "default" });
    }
    return { id: n.id, kind: n.kind, label: n.label, x: n.x, y: n.y, config };
  });

  // Gateway routing weights = observed share of traffic to each upstream.
  const routeCount = (to: string) => {
    const t = TELEMETRY_ID[to];
    const viaGateway = stats?.edges?.[`api-gateway->${t}`]?.count ?? 0;
    if (viaGateway > 0) return viaGateway;
    // Local dev without the gateway: the browser talks to services directly.
    return stats?.edges?.[`client->${t}`]?.count ?? 0;
  };
  const gwTargets = ["auth", "case", "file"];
  const counts = gwTargets.map(routeCount);
  const anyRoute = counts.some((c) => c > 0);

  const bsEdges: BsEdge[] = EDGES.map(([from, to]) => {
    let weight = 1;
    if (from === "gateway" && anyRoute) {
      const c = counts[gwTargets.indexOf(to)];
      weight = Math.max(0.01, c); // a zero weight would delete the route entirely
      calibration.push({ node: "API gateway:4000", field: `weight→${to}`, value: c, source: "live" });
    }
    return { id: `${from}->${to}`, from, to, weight };
  });

  const liveSamples = stats ? Object.values(stats.nodes).reduce((a, n) => a + (n?.count || 0), 0) : 0;
  const stamp = now.toISOString().replace("T", " ").slice(0, 16);
  const note =
    `LegalVault — calibrated from live telemetry (${stamp} UTC).\n` +
    `Client rate = measured ${round(live("client")?.rps ?? 0)} req/s × ${mult}. ` +
    `Service times = measured median self time; error rates = measured 5xx. ` +
    `${liveSamples} live samples.`;

  const topology = {
    nodes: bsNodes,
    edges: bsEdges,
    annotations: [{ id: "lv-live-note", kind: "note", text: note, x: 600, y: 650, width: 420 }],
  };

  return { url: `${BREAKSCALE_ORIGIN}#${encodeD2(topology)}`, calibration, liveSamples };
}
