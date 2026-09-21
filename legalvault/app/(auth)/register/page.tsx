import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-white">Create your workspace</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-400">One account per chambers to start.</p>
      <RegisterForm />
    </div>
  );
}
