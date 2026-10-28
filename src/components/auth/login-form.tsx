"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { describeSignInError } from "@/features/auth/messages";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function LoginForm({ next, notice }: { next: string | null; notice?: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const callbackURL = `/continue${nextQuery}`;

    const { data, error: failure } = await authClient.signIn.email({ email, password, callbackURL });
    setPending(false);

    if (failure) {
      const outcome = describeSignInError(failure);
      if (outcome.kind === "email-not-verified") {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(outcome.message);
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      router.push(`/two-factor${nextQuery}`);
      return;
    }
    router.push(callbackURL);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending} className="space-y-5">
      {notice ? (
        <p role="status" className="border-success/30 bg-success/10 rounded-lg border px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}
      <FormField id="email" label="Email" required>
        {(c) => <Input name="email" type="email" autoComplete="username" required {...c} />}
      </FormField>
      <FormField id="password" label="Password" required>
        {(c) => <Input name="password" type="password" autoComplete="current-password" required {...c} />}
      </FormField>
      {error ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-accent font-medium hover:underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
