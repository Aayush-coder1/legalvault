/**
 * Base API client. All services use HttpOnly cookies, so every
 * request sends credentials:include. Blank env = fetch fails fast
 * with a clear message (user fills .env.local).
 */

function base(name: string, fallback: string): string {
  const v = process.env[name] || fallback;
  return v.replace(/\/$/, "");
}

export const AUTH_URL = base("NEXT_PUBLIC_AUTH_URL", "http://localhost:4001");
export const CASE_URL = base("NEXT_PUBLIC_CASE_URL", "http://localhost:4002");
export const FILE_URL = base("NEXT_PUBLIC_FILE_URL", "http://localhost:4003");

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
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

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  return parse<T>(res);
}

export function apiJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  return api<T>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
