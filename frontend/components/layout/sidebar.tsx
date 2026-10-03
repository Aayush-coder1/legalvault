"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Brand } from "@/components/layout/brand";
import { useSession } from "@/components/auth/session";
import { ROUTES } from "@/lib/config/constants";

const NAV = [
  { label: "Overview", href: ROUTES.dashboard, icon: LayoutDashboard, exact: true },
  { label: "Cases", href: ROUTES.dashboard, icon: Briefcase, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, workspace } = useSession();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-black/40 lg:flex">
      <div className="flex h-16 items-center border-b border-white/5 px-5">
        <Brand href={ROUTES.dashboard} />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Dashboard">
        <p className="px-3 pb-2 text-[11px] font-medium tracking-widest text-zinc-600 uppercase">
          {workspace}
        </p>
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/5 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e3b341] text-xs font-semibold text-zinc-950" aria-hidden>
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
