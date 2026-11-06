/** Shapes sent by the gateway's /api/v1/telemetry/stream (see services/api-gateway/src/telemetry). */

export type NodeId =
  | "client"
  | "api-gateway"
  | "auth-service"
  | "case-service"
  | "file-service"
  | "crypto-proxy"
  | "mongodb"
  | "b2";

/** One hop of one request, e.g. case-service -> crypto-proxy. */
export interface EdgeEvent {
  id: string;
  ts: number;
  from: NodeId;
  to: NodeId;
  method: string;
  route: string;
  status: number;
  ms: number;
  self?: number;
  bytes: number;
  err?: string;
}

export interface NodeStats {
  count: number;
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  meanMs: number;
  selfP50: number | null;
  err4xx: number;
  err5xx: number;
  errorRate: number;
  serverErrorRate: number;
  bytesPerSec: number;
  totalBytes: number;
  inFlight: number;
}

export interface EdgeStats {
  rps: number;
  count: number;
  p95: number;
  /** 4xx + 5xx, percent */
  errorRate: number;
  /** 5xx + unreachable only, percent */
  serverErrorRate?: number;
}

export interface ServiceHealth {
  status: "up" | "down" | "unknown" | "disabled";
  checkedAt?: number;
  lastOkAt?: number;
  error?: string;
  pollMs?: number;
  dropped?: number;
}

export interface TelemetryStats {
  serverNow: number;
  windowMs: number;
  rateWindowMs: number;
  global: {
    rps: number;
    p50: number;
    p95: number;
    p99: number;
    errorRate: number;
    serverErrorRate?: number;
    err4xx: number;
    err5xx: number;
    requests: number;
    internalRps: number;
  };
  crypto: {
    rps: number;
    p95: number;
    inFlight: number;
    bytesPerSec: number;
    errorRate: number;
    b2Rps: number;
    mongoRps: number;
  };
  nodes: Record<NodeId, NodeStats>;
  edges: Record<string, EdgeStats>;
  health: Partial<Record<NodeId, ServiceHealth>>;
  totals: { events: number; since: number };
}

export interface TrafficBatch {
  traffic: EdgeEvent[];
  serverNow: number;
}

export type StreamStatus = "connecting" | "live" | "reconnecting" | "unauthorized" | "error";
