"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { ROUTES } from "@/lib/config/constants";

/** UI-only registration form. Wires to POST /api/auth/register once auth lands. */
export function RegisterForm() {
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
      <Field label="Full name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" placeholder="Aarav Sharma" required />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@chambers.in" required />
      </Field>
      <Field label="Password" htmlFor="password" hint="Minimum 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="••••••••" minLength={8} required />
      </Field>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-[13px] text-gray-500">
        Already have an account?{" "}
        <Link href={ROUTES.login} className="font-medium text-gray-950 underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
