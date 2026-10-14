import { AUTH_URL, api, apiJson, silentRefresh, setTokens, clearTokens } from "@/lib/api/client";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  tenantId: string;
}

interface SessionData {
  user: AuthUser;
  accessToken?: string;
  refreshToken?: string;
}

function storeSession(d: SessionData) {
  if (d.accessToken || d.refreshToken) setTokens(d.accessToken ?? null, d.refreshToken ?? null);
  return d;
}

export async function signup(name: string, email: string, password: string) {
  const data = await apiJson<SessionData>(`${AUTH_URL}/auth/signup`, "POST", { name, email, password });
  return storeSession(data);
}

export async function login(email: string, password: string) {
  const data = await apiJson<SessionData>(`${AUTH_URL}/auth/login`, "POST", { email, password });
  return storeSession(data);
}

export async function logout() {
  try {
    return await apiJson<{ ok: boolean }>(`${AUTH_URL}/auth/logout`, "POST");
  } finally {
    clearTokens();
  }
}

export function me() {
  return api<{ user: AuthUser }>(`${AUTH_URL}/auth/me`);
}

export function refreshSession() {
  return silentRefresh();
}
