/**
 * Layout of the live system topology. Mirrors the team's BreakScale design
 * (docs/breakscale-simulation.png) so the live view and the simulation read
 * the same way. Coordinates are in a 1000 x 560 virtual canvas.
 */
import type { NodeId } from "./types";

export const CANVAS_W = 1000;
export const CANVAS_H = 560;
export const NODE_W = 196;
export const NODE_H = 96;

export interface TopologyNode {
  id: NodeId;
  label: string;
  sub: string;
  kind: "client" | "gateway" | "service" | "crypto" | "db" | "store";
  x: number;
  y: number;
}

export const NODES: readonly TopologyNode[] = [
  { id: "client", label: "Browser / Next.js", sub: "client", kind: "client", x: 16, y: 30 },
  { id: "api-gateway", label: "API gateway", sub: "", kind: "gateway", x: 16, y: 232 },
  { id: "auth-service", label: "Auth service", sub: "", kind: "service", x: 40, y: 438 },
  { id: "case-service", label: "Case service", sub: "", kind: "service", x: 282, y: 16 },
  { id: "file-service", label: "File service", sub: "", kind: "service", x: 290, y: 330 },
  { id: "crypto-proxy", label: "Crypto proxy", sub: "", kind: "crypto", x: 520, y: 176 },
  { id: "b2", label: "Backblaze B2", sub: "S3 object store", kind: "store", x: 784, y: 70 },
  { id: "mongodb", label: "MongoDB Atlas", sub: "database", kind: "db", x: 742, y: 438 },
];

export const NODE_BY_ID: Record<NodeId, TopologyNode> = Object.fromEntries(
  NODES.map((n) => [n.id, n]),
) as Record<NodeId, TopologyNode>;

/** Request paths drawn even when idle (same wiring as the BreakScale design). */
export const BASE_EDGES: ReadonlyArray<readonly [NodeId, NodeId]> = [
  ["client", "api-gateway"],
  ["api-gateway", "auth-service"],
  ["api-gateway", "case-service"],
  ["api-gateway", "file-service"],
  ["case-service", "crypto-proxy"],
  ["file-service", "crypto-proxy"],
  ["crypto-proxy", "b2"],
  ["crypto-proxy", "mongodb"],
  ["auth-service", "mongodb"],
];

export function edgeKey(from: string, to: string) {
  return `${from}->${to}`;
}

export const BASE_EDGE_KEYS = new Set(BASE_EDGES.map(([a, b]) => edgeKey(a, b)));

export interface Point {
  x: number;
  y: number;
}

export interface EdgeGeometry {
  p0: Point;
  c1: Point;
  c2: Point;
  p3: Point;
  d: string;
  mid: Point;
}

function center(n: TopologyNode): Point {
  return { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 };
}

/**
 * A smooth cubic from the side of `from` facing `to` into the facing side
 * of `to`: vertical links leave from top/bottom, horizontal from left/right.
 */
export function edgeGeometry(fromId: NodeId, toId: NodeId): EdgeGeometry {
  const a = NODE_BY_ID[fromId];
  const b = NODE_BY_ID[toId];
  const ca = center(a);
  const cb = center(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  let p0: Point;
  let p3: Point;
  let c1: Point;
  let c2: Point;
  if (Math.abs(dx) > Math.abs(dy) * 1.1) {
    const dir = Math.sign(dx) || 1;
    p0 = { x: dir > 0 ? a.x + NODE_W : a.x, y: ca.y };
    p3 = { x: dir > 0 ? b.x : b.x + NODE_W, y: cb.y };
    const k = Math.max(40, Math.abs(p3.x - p0.x) * 0.45);
    c1 = { x: p0.x + dir * k, y: p0.y };
    c2 = { x: p3.x - dir * k, y: p3.y };
  } else {
    const dir = Math.sign(dy) || 1;
    p0 = { x: ca.x, y: dir > 0 ? a.y + NODE_H : a.y };
    p3 = { x: cb.x, y: dir > 0 ? b.y : b.y + NODE_H };
    const k = Math.max(30, Math.abs(p3.y - p0.y) * 0.45);
    c1 = { x: p0.x, y: p0.y + dir * k };
    c2 = { x: p3.x, y: p3.y - dir * k };
  }
  const d = `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p3.x} ${p3.y}`;
  return { p0, c1, c2, p3, d, mid: bezierPoint({ p0, c1, c2, p3 }, 0.5) };
}

export function bezierPoint(g: Pick<EdgeGeometry, "p0" | "c1" | "c2" | "p3">, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * g.p0.x + b * g.c1.x + c * g.c2.x + d * g.p3.x,
    y: a * g.p0.y + b * g.c1.y + c * g.c2.y + d * g.p3.y,
  };
}
