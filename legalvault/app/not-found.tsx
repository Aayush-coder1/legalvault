import Link from "next/link";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/config/constants";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-white px-4 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
        <Scale className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gray-950">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        The page you&apos;re looking for doesn&apos;t exist or was moved.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href={ROUTES.dashboard}>
          <Button>Go to dashboard</Button>
        </Link>
        <Link href={ROUTES.landing}>
          <Button variant="outline">Home</Button>
        </Link>
      </div>
    </div>
  );
}
