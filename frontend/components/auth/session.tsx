"use client";

import * as React from "react";

/**
 * Preview session for the UI foundation.
 *
 * Holds "who is signed in" on the client so the header, sidebar and
 * dashboard reflect the name/email typed at login/register instead of a
 * hardcoded demo user. Persisted to localStorage; falls back to a demo
 * identity when nothing was entered (e.g. deep-linking /dashboard).
 *
 * State lives in a tiny external store read via useSyncExternalStore
 * (SSR-safe: server snapshot is always "no session").
 *
 * Replaced by JWT httpOnly-cookie auth later — at that point this module
 * becomes a thin reader of GET /api/auth/me, and all consumers stay the same.
 */

export interface SessionUser {
  name: string;
  email: string;
}

export const DEMO_USER: SessionUser = {
  name: "Aarav Sharma",
  email: "aarav.sharma@chambers.in",
};

const STORAGE_KEY = "legalvault.preview-user";

type Listener = () => void;

const listeners = new Set<Listener>();
let current: SessionUser | null = null;
let initialized = false;

function readStored(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (typeof parsed.name === "string" && typeof parsed.email === "string") {
      return { name: parsed.name, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}

function ensureInit(): void {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    current = readStored();
  }
}

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      current = readStored();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): SessionUser | null {
  ensureInit();
  return current;
}

function getServerSnapshot(): SessionUser | null {
  return null;
}

function persist(next: SessionUser | null): void {
  current = next;
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Preview only — storage failure shouldn't block navigation.
  }
  emit();
}

interface SessionValue {
  user: SessionUser;
  /** True while showing the fallback demo identity. */
  isDemo: boolean;
  /** Workspace label derived from the signed-in email domain. */
  workspace: string;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
}

const SessionContext = React.createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const stored = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = stored ?? DEMO_USER;

  const value = React.useMemo<SessionValue>(() => {
    const domain = user.email.split("@")[1];
    return {
      user,
      isDemo: stored === null,
      workspace: domain ? domain.split(".")[0] : "workspace",
      signIn: (next) => persist(next),
      signOut: () => persist(null),
    };
  }, [user, stored]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/** Display name from an email address ("aarav.sharma@.." -> "Aarav Sharma"). */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "Counsel";
  const parts = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  return parts.length > 0 ? parts.join(" ") : "Counsel";
}
