/**
 * Base API client. Auth uses HttpOnly cookies (primary) + Bearer fallback.
 *
 * Deployment reality: frontend and gateway are different hosts
 * (…-hdo5.onrender.com vs …gateway.onrender.com) => cross-site. Cookies need
 * SameSite=None+Secure (fixed server-side) AND a Bearer fallback for browsers
 * that block third-party cookies. Every request sends credentials:include
 * plus Authorization when we hold an access token in memory.
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

// Render free tier cold-starts can take 30-50s. 15s timeouts made login look
// "broken" on a sleeping backend. Give real requests 35s.
const DEFAULT_TIMEOUT_MS = 35000;
const REFRESH_TIMEOUT_MS = 25000;

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

// ---- Bearer fallback token store (memory + sessionStorage) ----
// Cookies remain primary. These exist so auth survives cross-site +
// third-party-cookie-blocked browsers: login/signup/refresh responses now
// include { accessToken, refreshToken } and we replay them via Authorization.
const ACCESS_KEY = "lv_access_token";
const REFRESH_KEY = "lv_refresh_token";

let memAccess: string | null = null;
let memRefresh: string | null = null;

function readStored(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, val: string | null) {
  try {
    if (val) sessionStorage.setItem(key, val);
    else sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable (private mode) — memory still works */
  }
}

export function getAccessToken(): string | null {
  return memAccess ?? readStored(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return memRefresh ?? readStored(REFRESH_KEY);
}

export function setTokens(access: string | null | undefined, refresh: string | null | undefined) {
  if (access !== undefined) {
    memAccess = access || null;
    writeStored(ACCESS_KEY, memAccess);
  }
  if (refresh !== undefined) {
    memRefresh = refresh || null;
    writeStored(REFRESH_KEY, memRefresh);
  }
}

export function clearTokens() {
  memAccess = null;
  memRefresh = null;
  writeStored(ACCESS_KEY, null);
  writeStored(REFRESH_KEY, null);
}

// Hydrate memory from storage on first import (survives page reload within tab).
if (typeof window !== "undefined") {
  memAccess = readStored(ACCESS_KEY);
  memRefresh = readStored(REFRESH_KEY);
}

function withAuth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  const at = getAccessToken();
  if (at && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${at}`);
  return { credentials: "include", ...init, headers };
}

/** Capture tokens from any auth response body shaped { accessToken?, refreshToken? }. */
function captureAuthTokens(data: unknown) {
  if (data && typeof data === "object") {
    const d = data as { accessToken?: unknown; refreshToken?: unknown };
    const at = typeof d.accessToken === "string" ? d.accessToken : undefined;
    const rt = typeof d.refreshToken === "string" ? d.refreshToken : undefined;
    if (at !== undefined || rt !== undefined) setTokens(at, rt);
  }
}

// Single-flight silent refresh: at most one POST /auth/refresh in flight.
// Sends cookie AND body refresh token so it works with or without third-party cookies.
let refreshInflight: Promise<boolean> | null = null;
async function silentRefresh(): Promise<boolean> {
  if (refreshInflight) {
    try { await refreshInflight; return true; } catch { return false; }
  }
  refreshInflight = (async () => {
    const rt = getRefreshToken();
    const body = rt ? { refreshToken: rt } : {};
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const res = await fetchWithTimeout(
      `${AUTH_URL}/auth/refresh`,
      { method: "POST", credentials: "include", headers, body: JSON.stringify(body) },
      REFRESH_TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`refresh ${res.status}`);
    const json = await res.json().catch(() => null);
    if (!json?.success) throw new Error("refresh failed");
    captureAuthTokens(json.data);
    return true;
  })().finally(() => { refreshInflight = null; });
  try { await refreshInflight; return true; } catch { return false; }
}

// Endpoints that must never auto-retry (would loop or mask bad credentials).
function isNoRetryAuthEndpoint(url: string): boolean {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/signup") ||
    url.includes("/auth/register") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout")
  );
}

export async function api<T>(url: string, init?: RequestInit, retryOn401 = true): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithTimeout(url, withAuth(init));
  } catch (e) {
    throw new ApiError("NETWORK_FAIL", e instanceof Error && e.name === "AbortError" ? "Request timed out — backend may be waking up, try again" : "Cannot reach backend", 0);
  }
  // 401 on any authed endpoint (including /auth/me, /cases, /files) gets one
  // silent-refresh + retry. Login/signup/refresh/logout themselves never retry.
  if (res.status === 401 && retryOn401 && !isNoRetryAuthEndpoint(url)) {
    const ok = await silentRefresh();
    if (ok) {
      try {
        res = await fetchWithTimeout(url, withAuth(init));
      } catch {
        throw new ApiError("NETWORK_FAIL", "Cannot reach backend", 0);
      }
    }
  }
  const data = await parse<T>(res);
  // Any auth endpoint may rotate tokens — capture them.
  if (url.includes("/auth/")) captureAuthTokens(data);
  return data;
}

export function apiJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  return api<T>(url, {
    method,
    headers: { "Content-Type": "application/json", "x-request-id": crypto.randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Raw authed fetch for non-JSON flows (multipart upload, blob download).
 * Attaches cookies + Bearer, refreshes once on 401, then retries once.
 */
export async function authedFetch(url: string, init: RequestInit = {}, timeoutMs = 60000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res = await fetch(url, { ...withAuth(init), signal: init.signal ?? ctrl.signal });
    if (res.status === 401 && !isNoRetryAuthEndpoint(url)) {
      const ok = await silentRefresh();
      if (ok) res = await fetch(url, { ...withAuth(init), signal: init.signal ?? ctrl.signal });
    }
    return res;
  } finally {
    clearTimeout(t);
  }
}

export { silentRefresh };
