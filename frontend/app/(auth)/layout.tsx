import { Brand } from "@/components/layout/brand";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/config/constants";

/** Shared centered shell for sign-in / registration. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-zinc-950">
      <div className="bg-grid mask-fade-y absolute inset-0" aria-hidden />
      <div
        className="absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(227,179,65,0.08),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="mb-6 flex justify-center">
          <Brand href={ROUTES.landing} />
        </div>
        <Card className="border-white/10 bg-zinc-900/70 p-6 shadow-2xl shadow-black/50 backdrop-blur sm:p-8">
          {children}
        </Card>
        <p className="mt-6 text-center font-mono text-xs text-zinc-600">Protected by workspace isolation and encryption.</p>
      </div>
    </div>
  );
}
