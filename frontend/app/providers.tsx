"use client";

import { SessionProvider } from "@/components/auth/session";

/** Client-side providers mounted once in the root layout. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
