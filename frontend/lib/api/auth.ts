import { AUTH_URL, api, apiJson, silentRefresh } from "@/lib/api/client";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  tenantId: string;
}

export function signup(name: string, email: string, password: string) {
  return apiJson<{ user: AuthUser }>(`${AUTH_URL}/auth/signup`, "POST", { name, email, password });
}

export function login(email: string, password: string) {
  return apiJson<{ user: AuthUser }>(`${AUTH_URL}/auth/login`, "POST", { email, password });
}

export function logout() {
  return apiJson<{ ok: boolean }>(`${AUTH_URL}/auth/logout`, "POST");
}

export function me() {
  return api<{ user: AuthUser }>(`${AUTH_URL}/auth/me`);
}

export function refreshSession() {
  return silentRefresh();
}
