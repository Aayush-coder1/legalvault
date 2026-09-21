import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/layout/brand";
import { ROUTES } from "@/lib/config/constants";

const LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Security", href: "/#security" },
  { label: "How it works", href: "/#how-it-works" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="text-sm text-zinc-400 transition-colors hover:text-white">
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
