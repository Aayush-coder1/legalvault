"use client";

import { useSession } from "@/components/auth/session";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ROUTES } from "@/lib/config/constants";

/** Dashboard shell: auth guard (redirect to login if no session). */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) router.push(ROUTES.login);
  }, [loading, user, router]);

  if (loading) return <p className="p-6 text-sm text-zinc-500">Checking session…</p>;
  if (!user) return null;

  return <div className="min-h-full bg-zinc-950">{children}</div>;
}
