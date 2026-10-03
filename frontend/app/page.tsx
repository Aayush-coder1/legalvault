import Link from "next/link";
import { ArrowRight, Cloud, FileText, Lock, Search, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { APP_TAGLINE, ROUTES } from "@/lib/config/constants";

const FEATURES = [
  {
    icon: FileText,
    title: "Matters, organized",
    description: "Every case gets a number, a status and a clean record — no spreadsheets lost in inboxes.",
  },
  {
    icon: Upload,
    title: "Evidence vault",
    description: "PDFs, images, video and notes attached to the right case, with sizes and dates tracked.",
  },
  {
    icon: Search,
    title: "Find anything fast",
    description: "Search across titles and case numbers, filter by status, jump straight to the file.",
  },
  {
    icon: Lock,
    title: "Tenant isolation",
    description: "Each chambers sees only its own matters. Isolation is enforced at the data layer.",
  },
  {
    icon: ShieldCheck,
    title: "Encryption-ready",
    description: "Sensitive fields pass through an encryption service designed for KMS from day one.",
  },
  {
    icon: Cloud,
    title: "Cloud-ready foundation",
    description: "Local storage and mock data today behind interfaces that map to S3 and DynamoDB tomorrow.",
  },
];

const STEPS = [
  { n: "01", title: "Create a case", description: "Title, case number, status — under a minute." },
  { n: "02", title: "Attach evidence", description: "Drop in PDFs, photos, recordings or quick notes." },
  { n: "03", title: "Work the matter", description: "Track status, review the record, stay audit-clean." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-950">
      <MarketingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="bg-grid mask-fade-y absolute inset-0" aria-hidden />
          <div
            className="absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(227,179,65,0.09),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
            <Badge variant="gold" className="mb-5">
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              Built for litigation chambers
            </Badge>
            <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              Every case. Every file.
              <span className="block text-zinc-500">Under control.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">{APP_TAGLINE} Keep every case, document and note in one calm, secure workspace.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={ROUTES.register}>
                <Button size="lg">
                  Start free <ArrowRight aria-hidden />
                </Button>
              </Link>
              <Link href={ROUTES.login}>
                <Button size="lg" variant="outline">
                  Sign in to dashboard
                </Button>
              </Link>
            </div>
            <p className="mt-4 font-mono text-xs text-zinc-600">Tenant-isolated · Encrypted · Audited</p>
          </div>
        </section>

        {/* Product preview */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-label="Preview">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-white/10" />
              <span className="size-2.5 rounded-full bg-white/10" />
              <span className="size-2.5 rounded-full bg-white/10" />
              <span className="ml-3 hidden font-mono text-xs text-zinc-600 sm:block">app.legalvault.in/dashboard</span>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-6">
              {[
                { title: "Mehta Property Partition Suit", meta: "CS/2026/0142 · Open" },
                { title: "Nexus Labs Employment Dispute", meta: "LC/2026/0087 · In progress" },
                { title: "BluePeak Trademark Opposition", meta: "TM/2026/0054 · Open" },
              ].map((c) => (
                <div key={c.meta} className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-left transition-colors hover:border-white/20">
                  <p className="truncate text-sm font-semibold text-white">{c.title}</p>
                  <p className="mt-1 font-mono text-xs text-zinc-500">{c.meta}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-center text-xs font-semibold tracking-widest text-[#e3b341] uppercase">Features</p>
          <h2 className="mx-auto mt-2 max-w-xl text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Everything a case file needs, nothing it doesn&apos;t
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="transition-colors hover:border-white/20">
                <CardContent className="pt-5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                    <f.icon className="size-4" aria-hidden />
                  </span>
                  <CardTitle className="mt-3">{f.title}</CardTitle>
                  <CardDescription className="mt-1 !text-zinc-400">{f.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-20 border-y border-white/5 bg-white/[0.01]">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest text-[#e3b341] uppercase">Security</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Client confidentiality, architected in
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
                A dedicated proxy engine sits between the app and the data: it resolves your workspace,
                enforces access, encrypts sensitive fields and writes an audit trail — on every request.
              </p>
            </div>
            <ul className="space-y-3">
              {[
                "Workspace-scoped data access on every query",
                "AES-256 encryption service, KMS-compatible interface",
                "Audit log of who viewed, changed or deleted what",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-200">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#e3b341]" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works + CTA */}
        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <p className="font-mono text-xs text-[#e3b341]">{s.n}</p>
                <h3 className="mt-2 text-[15px] font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-[13px] text-zinc-400">{s.description}</p>
              </div>
            ))}
          </div>
          <div className="relative mt-10 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.02] px-6 py-12 text-center sm:px-12">
            <div
              className="absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,rgba(227,179,65,0.12),transparent)]"
              aria-hidden
            />
            <h2 className="relative mx-auto max-w-xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Bring order to your chambers
            </h2>
            <p className="relative mx-auto mt-2 max-w-lg text-[15px] text-zinc-400">
              Create a workspace, add your first matter, and attach evidence in minutes.
            </p>
            <div className="relative mt-6">
              <Link href={ROUTES.register}>
                <Button size="lg">
                  Create your workspace <ArrowRight aria-hidden />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-[13px] text-zinc-500 sm:flex-row sm:px-6">
          <p>© 2026 LegalVault. Built for the way lawyers work.</p>
          <p className="font-mono text-xs">Tenant-isolated · Encrypted · Audited</p>
        </div>
      </footer>
    </div>
  );
}
