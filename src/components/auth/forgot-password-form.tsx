"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [state, setState] = useState<"idle" | "pending" | "sent" | "limited">("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    // Same answer whether or not the account exists, so this form can't be used to discover accounts.
    setState(error?.status === 429 ? "limited" : "sent");
  }

  if (state === "sent") {
    return (
      <p role="status" className="text-sm leading-relaxed">
        If an account exists for that email address, we&apos;ve sent a link to reset the password. It expires
        in 1 hour.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={state === "pending"} className="space-y-5">
      <FormField id="email" label="Email" required>
        {(c) => <Input name="email" type="email" autoComplete="email" required {...c} />}
      </FormField>
      {state === "limited" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          Too many requests. Please wait a while and try again.
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={state === "pending"}>
        {state === "pending" ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
