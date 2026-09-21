"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Brand } from "@/components/layout/brand";
import { mockUser } from "@/lib/mock-data";
import { ROUTES } from "@/lib/config/constants";

const NAV = [
  { label: "Overview", href: ROUTES.dashboard, icon: LayoutDashboard, exact: true },
  { label: "Cases", href: ROUTES.dashboard, icon: Briefcase, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
      <div className="flex h-16 items-center border-b border-gray-100 px-5">
        <Brand href={ROUTES.dashboard} />
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Dashboard">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-gray-100 text-gray-950" : "text-gray-600 hover:bg-gray-50 hover:text-gray-950",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-gray-950 text-xs font-semibold text-white" aria-hidden>
            {mockUser.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-gray-950">{mockUser.name}</p>
            <p className="truncate text-xs text-gray-500">{mockUser.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
