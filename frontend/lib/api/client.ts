/**
 * Base API client. All services use HttpOnly cookies, so every
 * request sends credentials:include. Blank env = fetch fails fast
 * with a clear message (user fills .env.local).
 */

// NOTE: Next.js inlines process.env.* into the browser bundle at build time
// ONLY for literal keys (process.env.NEXT_PUBLIC_X). Dynamic lookup like
// process.env[name] is always undefined in the browser, so the localhost
// fallback won below — no Render env change could ever fix that. Keep each
// key literal.
function strip(url: string): string {
  return url.replace(/\/$/, "");
}

export const AUTH_URL = strip(process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:4001");
export const CASE_URL = strip(process.env.NEXT_PUBLIC_CASE_URL || "http://localhost:4002");
export const FILE_URL = strip(process.env.NEXT_PUBLIC_FILE_URL || "http://localhost:4003");

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: init.signal ?? ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new ApiError(
      json?.error?.code || "REQUEST_FAILED",
      json?.error?.message || `Request failed (${res.status})`,
      res.status
    );
  }
  return json.data as T;
}

// Single-flight silent refresh: at most one POST /auth/refresh in flight.
let refreshInflight: Promise<unknown> | null = null;
async function silentRefresh(): Promise<boolean> {
  if (refreshInflight) {
    try { await refreshInflight; return true; } catch { return false; }
  }
  refreshInflight = fetchWithTimeout(`${AUTH_URL}/auth/refresh`, { method: "POST", credentials: "include" }, 10000)
    .then(async (r) => { if (!r.ok) throw new Error(`refresh ${r.status}`); return r.json().catch(() => null); })
    .finally(() => { refreshInflight = null; });
  try { await refreshInflight; return true; } catch { return false; }
}

export async function api<T>(url: string, init?: RequestInit, retryOn401 = true): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithTimeout(url, { credentials: "include", ...init });
  } catch (e) {
    throw new ApiError("NETWORK_FAIL", e instanceof Error && e.name === "AbortError" ? "Request timed out, try again" : "Cannot reach backend", 0);
  }
  if (res.status === 401 && retryOn401 && !url.includes("/auth/")) {
    const ok = await silentRefresh();
    if (ok) {
      try {
        res = await fetchWithTimeout(url, { credentials: "include", ...init });
      } catch {
        throw new ApiError("NETWORK_FAIL", "Cannot reach backend", 0);
      }
    }
  }
  return parse<T>(res);
}

export function apiJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  return api<T>(url, {
    method,
    headers: { "Content-Type": "application/json", "x-request-id": crypto.randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export { silentRefresh };
