"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { ROUTES } from "@/lib/config/constants";

/** UI-only sign-in form. Wires to POST /api/auth/login once auth lands. */
export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    // UI foundation: navigate to the dashboard preview.
    router.push(ROUTES.dashboard);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@chambers.in" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
      </Field>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-[13px] text-gray-500">
        New to LegalVault?{" "}
        <Link href={ROUTES.register} className="font-medium text-gray-950 underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
