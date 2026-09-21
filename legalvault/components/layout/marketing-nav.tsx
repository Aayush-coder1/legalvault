import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/layout/brand";
import { ROUTES } from "@/lib/config/constants";

const LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Security", href: "/#security" },
  { label: "Pricing", href: "/#pricing" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="text-sm text-gray-600 transition-colors hover:text-gray-950">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href={ROUTES.login}>
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href={ROUTES.register}>
            <Button>Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
