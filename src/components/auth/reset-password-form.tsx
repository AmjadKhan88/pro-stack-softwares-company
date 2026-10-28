"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [expired, setExpired] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password") ?? "");
    if (newPassword.length < 12) return setError("Use at least 12 characters.");
    if (newPassword !== String(form.get("confirm") ?? "")) return setError("The passwords don't match.");

    setPending(true);
    const { error: failure } = await authClient.resetPassword({ newPassword, token });
    setPending(false);
    if (failure) {
      if (failure.code === "INVALID_TOKEN") return setExpired(true);
      return setError(
        failure.status === 429
          ? "Too many attempts. Please wait and try again."
          : "We couldn't update the password. Please try again.",
      );
    }
    router.push("/login?reset=1");
  }

  if (expired) {
    return (
      <p role="alert" className="text-sm leading-relaxed">
        This link is invalid or has expired.{" "}
        <Link href="/forgot-password" className="text-accent font-medium hover:underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending} className="space-y-5">
      <FormField id="password" label="New password" hint="At least 12 characters." required>
        {(c) => (
          <Input name="password" type="password" autoComplete="new-password" minLength={12} required {...c} />
        )}
      </FormField>
      <FormField id="confirm" label="Repeat new password" required>
        {(c) => <Input name="confirm" type="password" autoComplete="new-password" required {...c} />}
      </FormField>
      {error ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
