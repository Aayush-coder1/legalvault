"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { nameFromEmail, useSession } from "@/components/auth/session";
import { ROUTES } from "@/lib/config/constants";

/** UI-only sign-in form. Wires to POST /api/auth/login once auth lands. */
export function LoginForm() {
  const router = useRouter();
  const { signIn } = useSession();
  const [pending, setPending] = React.useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    if (!email) return;
    setPending(true);
    // Preview session: remember who signed in so the header reflects them.
    signIn({ name: nameFromEmail(email), email });
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
      <p className="text-center text-[13px] text-zinc-500">
        New to LegalVault?{" "}
        <Link href={ROUTES.register} className="font-medium text-white underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
