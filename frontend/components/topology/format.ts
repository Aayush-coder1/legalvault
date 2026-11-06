/** Number formatting for the live topology. */

export function fmtMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0 ms";
  if (ms < 10) return `${ms.toFixed(1)} ms`;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
}

export function fmtRate(rps: number): string {
  if (!Number.isFinite(rps) || rps <= 0) return "0/s";
  if (rps < 10) return `${rps.toFixed(1)}/s`;
  return `${Math.round(rps)}/s`;
}

export function fmtBytesPerSec(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return "0 B/s";
  if (b < 1024) return `${Math.round(b)} B/s`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB/s`;
  return `${(b / 1024 / 1024).toFixed(1)} MB/s`;
}

export function fmtPct(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "0%";
  return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
}

export function fmtClock(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
