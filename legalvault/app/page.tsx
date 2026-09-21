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
    <div className="flex min-h-full flex-col bg-white">
      <MarketingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
          <Badge variant="outline" className="mb-5">
            Built for litigation chambers
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-gray-950 sm:text-5xl">
            LegalVault
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">{APP_TAGLINE} Keep every case, document and note in one calm, secure workspace.</p>
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
          <p className="mt-4 text-[13px] text-gray-500">No credit card · Your data stays isolated per workspace</p>
        </section>

        {/* Product preview strip */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-label="Preview">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex items-center gap-1.5 border-b border-gray-200 bg-white px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-gray-200" />
              <span className="size-2.5 rounded-full bg-gray-200" />
              <span className="size-2.5 rounded-full bg-gray-200" />
              <span className="ml-3 hidden font-mono text-xs text-gray-400 sm:block">app.legalvault.in/dashboard</span>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-6">
              {[
                { title: "Mehta Property Partition Suit", meta: "CS/2026/0142 · Open" },
                { title: "Nexus Labs Employment Dispute", meta: "LC/2026/0087 · In progress" },
                { title: "BluePeak Trademark Opposition", meta: "TM/2026/0054 · Open" },
              ].map((c) => (
                <div key={c.meta} className="rounded-lg border border-gray-200 bg-white p-4 text-left">
                  <p className="truncate text-sm font-semibold text-gray-950">{c.title}</p>
                  <p className="mt-1 font-mono text-xs text-gray-500">{c.meta}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
          <p className="text-center text-xs font-semibold tracking-widest text-gray-500 uppercase">Features</p>
          <h2 className="mx-auto mt-2 max-w-xl text-center text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">
            Everything a case file needs, nothing it doesn&apos;t
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardContent className="pt-5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-gray-950 text-white">
                    <f.icon className="size-4" aria-hidden />
                  </span>
                  <CardTitle className="mt-3">{f.title}</CardTitle>
                  <CardDescription className="mt-1">{f.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Security */}
        <section id="security" className="scroll-mt-20 border-y border-gray-200 bg-gray-50/70">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Security</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">
                Client confidentiality, architected in
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-gray-600">
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
                <li key={t} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-800">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gray-950" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works + pricing teaser */}
        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="font-mono text-xs text-gray-400">{s.n}</p>
                <h3 className="mt-2 text-[15px] font-semibold text-gray-950">{s.title}</h3>
                <p className="mt-1 text-[13px] text-gray-600">{s.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-xl bg-gray-950 px-6 py-10 text-center sm:px-12">
            <h2 className="mx-auto max-w-xl text-2xl font-semibold tracking-tight text-white">
              Bring order to your chambers this week
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-[15px] text-gray-400">
              Free for small teams during the pilot. Paid plans arrive with cloud storage and SSO.
            </p>
            <div className="mt-6">
              <Link href={ROUTES.register}>
                <Button size="lg" variant="secondary">
                  Create your workspace <ArrowRight aria-hidden />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-[13px] text-gray-500 sm:flex-row sm:px-6">
          <p>© 2026 LegalVault. Built for the way lawyers work.</p>
          <p className="font-mono text-xs">Tenant-isolated · Encrypted · Audited</p>
        </div>
      </footer>
    </div>
  );
}
