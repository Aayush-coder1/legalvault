import { Brand } from "@/components/layout/brand";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/config/constants";

/** Shared centered shell for sign-in / registration. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-gray-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="mb-6 flex justify-center">
          <Brand href={ROUTES.landing} />
        </div>
        <Card className="p-6 sm:p-8">{children}</Card>
        <p className="mt-6 text-center text-xs text-gray-500">Protected by workspace isolation and encryption.</p>
      </div>
    </div>
  );
}
