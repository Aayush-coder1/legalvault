"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, LayoutDashboard, LogOut, Menu, Scale, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { mockUser } from "@/lib/mock-data";
import { ROUTES } from "@/lib/config/constants";

export function DashboardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="cursor-pointer rounded-md p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold text-gray-950">{title}</h1>
            {subtitle ? <p className="truncate text-[13px] text-gray-500">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[13px] text-gray-500 sm:block">{mockUser.email}</span>
          <Link href={ROUTES.login} aria-label="Log out">
            <Button variant="outline" size="sm">
              <LogOut aria-hidden /> Log out
            </Button>
          </Link>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-gray-100 px-4 py-2 lg:hidden" aria-label="Mobile">
          {[
            { label: "Overview", href: ROUTES.dashboard, icon: LayoutDashboard },
            { label: "Cases", href: ROUTES.dashboard, icon: Briefcase },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === item.href ? "page" : undefined}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          ))}
          <p className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
            <Scale className="size-3.5" aria-hidden /> Tenant: {mockUser.id}
          </p>
        </nav>
      ) : null}
    </header>
  );
}
