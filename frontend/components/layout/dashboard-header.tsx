"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/layout/brand";
import { useSession } from "@/components/auth/session";
import { ROUTES } from "@/lib/config/constants";

export function DashboardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  const { user, signOut } = useSession();

  async function handleLogout() {
    await signOut();
    router.push(ROUTES.landing);
  }

  return (
    <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Brand href={ROUTES.dashboard} />
          <div className="hidden min-w-0 border-l border-white/10 pl-4 min-[420px]:block">
            <h1 className="truncate text-[15px] font-semibold text-white">{title}</h1>
            {subtitle ? <p className="truncate text-[13px] text-zinc-500">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2.5 sm:flex">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#e3b341] text-xs font-semibold text-zinc-950" aria-hidden>
              {(user?.name || "L").charAt(0).toUpperCase()}
            </span>
            <div className="leading-tight">
              <p className="max-w-40 truncate text-[13px] font-medium text-white">{user?.name ?? "…"}</p>
              <p className="max-w-40 truncate text-xs text-zinc-500">{user?.email ?? ""}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} aria-label="Log out">
            <LogOut aria-hidden /> <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
