"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/auth/session";
import { resetPreviewDb } from "@/components/cases/preview-store";
import { ROUTES } from "@/lib/config/constants";

export function DashboardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, workspace, signOut } = useSession();

  function handleLogout() {
    signOut();
    resetPreviewDb();
    router.push(ROUTES.login);
  }

  return (
    <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="cursor-pointer rounded-md p-1.5 text-zinc-400 hover:bg-white/5 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold text-white">{title}</h1>
            {subtitle ? <p className="truncate text-[13px] text-zinc-500">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2.5 sm:flex">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#e3b341] text-xs font-semibold text-zinc-950" aria-hidden>
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className="leading-tight">
              <p className="max-w-40 truncate text-[13px] font-medium text-white">{user.name}</p>
              <p className="max-w-40 truncate text-xs text-zinc-500">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} aria-label="Log out">
            <LogOut aria-hidden /> <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-white/5 px-4 py-2 lg:hidden" aria-label="Mobile">
          {[
            { label: "Overview", href: ROUTES.dashboard, icon: LayoutDashboard },
            { label: "Cases", href: ROUTES.dashboard, icon: Briefcase },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === item.href ? "page" : undefined}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          ))}
          <p className="px-3 py-2 font-mono text-xs text-zinc-600">
            {user.email} · {workspace}
          </p>
        </nav>
      ) : null}
    </header>
  );
}
