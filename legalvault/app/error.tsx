"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/config/constants";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-full flex-col items-center justify-center bg-white px-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-950">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          An unexpected error occurred. Please try again.
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={reset}>Try again</Button>
          <Link href={ROUTES.dashboard}>
            <Button variant="outline">Dashboard</Button>
          </Link>
        </div>
      </body>
    </html>
  );
}
