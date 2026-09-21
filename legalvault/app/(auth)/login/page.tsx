import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-white">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-400">Sign in to your chambers workspace.</p>
      <LoginForm />
    </div>
  );
}
