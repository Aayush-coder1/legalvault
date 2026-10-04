"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/config/constants";

// Route error boundary. Must NOT render <html>/<body> (root layout owns those);
// doing so causes a hydration error ("<html> cannot be a child of <body>").
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-950 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-white">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">
        An unexpected error occurred. Please try again.
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href={ROUTES.dashboard}>
          <Button variant="outline">Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
