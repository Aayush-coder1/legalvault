"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useSession } from "@/components/auth/session";
import { ROUTES } from "@/lib/config/constants";

/** UI-only registration form. Wires to POST /api/auth/register once auth lands. */
export function RegisterForm() {
  const router = useRouter();
  const { signIn } = useSession();
  const [pending, setPending] = React.useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    if (!name || !email) return;
    setPending(true);
    // Preview session: remember who registered so the header reflects them.
    signIn({ name, email });
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
      <p className="text-center text-[13px] text-zinc-500">
        Already have an account?{" "}
        <Link href={ROUTES.login} className="font-medium text-white underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
