"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { login } from "@/lib/api/auth";
import { useSession } from "@/components/auth/session";
import { ROUTES } from "@/lib/config/constants";

/** Real sign-in: POST /auth/login, cookie + Bearer session. */
export function LoginForm() {
  const router = useRouter();
  const { setUser } = useSession();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!email || !password) return;
    setPending(true);
    setError("");
    try {
      // Use the login response's user directly — no second /me roundtrip.
      // The old flow (login then refresh→me) stayed on this page whenever
      // the follow-up hit a cold-starting backend or a cookie race.
      const session = await login(email, password);
      setUser(session.user);
      router.push(ROUTES.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@chambers.in" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
      </Field>
      {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
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
