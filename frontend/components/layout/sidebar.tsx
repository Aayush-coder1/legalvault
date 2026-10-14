"use client";

import { Brand } from "@/components/layout/brand";
import { useSession } from "@/components/auth/session";
import { ROUTES } from "@/lib/config/constants";

export function Sidebar() {
  const { user } = useSession();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-black/40 lg:flex">
      <div className="flex h-16 items-center border-b border-white/5 px-5">
        <Brand href={ROUTES.dashboard} />
      </div>
      <div className="flex-1" />
      <div className="border-t border-white/5 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e3b341] text-xs font-semibold text-zinc-950" aria-hidden>
            {(user?.name || "L").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white">{user?.name ?? "…"}</p>
            <p className="truncate text-xs text-zinc-500">{user?.email ?? ""}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
