"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { signup } from "@/lib/api/auth";
import { useSession } from "@/components/auth/session";
import { ROUTES } from "@/lib/config/constants";

/** Real registration: POST /auth/signup, cookie + Bearer session. */
export function RegisterForm() {
  const router = useRouter();
  const { setUser } = useSession();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!name || !email || !password) return;
    setPending(true);
    setError("");
    try {
      const session = await signup(name, email, password);
      setUser(session.user);
      router.push(ROUTES.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setPending(false);
    }
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
      {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
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
