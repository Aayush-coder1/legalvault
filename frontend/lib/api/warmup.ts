import { AUTH_URL } from "@/lib/api/client";

/**
 * Cold-start warmup for Render's free tier: sleeping services take ~30-60s to
 * boot and the first real request would just time out. One GET to the
 * gateway's /readyz fans out and wakes everything (gateway -> auth/case/file
 * -> crypto-proxy), so the frontend fires this on load and retries until the
 * chain reports ready (or the budget runs out — login still attempted then).
 */

const ATTEMPT_TIMEOUT_MS = 25000;
const RETRY_INTERVAL_MS = 5000;
const DEFAULT_BUDGET_MS = 120000;

async function probeOnce(): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const res = await fetch(`${AUTH_URL}/readyz`, { credentials: "include", signal: ctrl.signal });
    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    return json?.ok === true;
  } catch {
    return false; // sleeping backend / timeout — keep retrying
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function warmBackend(budgetMs = DEFAULT_BUDGET_MS): Promise<boolean> {
  const start = Date.now();
  for (;;) {
    if (await probeOnce()) return true;
    if (Date.now() - start >= budgetMs) return false;
    await sleep(RETRY_INTERVAL_MS);
  }
}
