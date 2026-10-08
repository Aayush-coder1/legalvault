"use client";

import * as React from "react";
import { me as fetchMe, logout as apiLogout, refreshSession } from "@/lib/api/auth";

/**
 * Real session: reads GET /auth/me (HttpOnly cookie).
 * No localStorage, no demo user. Unauthenticated -> null user.
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  tenantId: string;
}

interface SessionValue {
  user: SessionUser | null;
  loading: boolean;
  workspace: string;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = React.createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMe().catch(async () => {
        // One silent-refresh attempt before giving up (covers 15m expiry).
        const ok = await refreshSession();
        if (!ok) return null;
        return fetchMe().catch(() => null);
      });
      setUser(data?.user ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // fetch-once on mount: legitimate data fetch, not cascading render
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Silent pre-refresh every 13m + on tab focus so idle sessions don't 401.
  React.useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      await refreshSession().catch(() => null);
    }, 13 * 60 * 1000);
    const onVis = () => {
      if (!document.hidden) refreshSession().catch(() => null);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const value = React.useMemo<SessionValue>(() => {
    const email = user?.email ?? "";
    const domain = email.split("@")[1];
    return {
      user,
      loading,
      workspace: domain ? domain.split(".")[0] : "workspace",
      refresh,
      signOut: async () => {
        await apiLogout().catch(() => null);
        setUser(null);
      },
    };
  }, [user, loading, refresh]);

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
