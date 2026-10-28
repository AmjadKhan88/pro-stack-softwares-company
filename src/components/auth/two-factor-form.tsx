"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { describeCodeError } from "@/features/auth/messages";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function TwoFactorForm({ next }: { next: string }) {
  const router = useRouter();
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    const { error: failure } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (failure) return setError(describeCodeError(failure));
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending} className="space-y-5">
      <FormField
        id="code"
        label={useBackup ? "Backup code" : "6-digit code"}
        hint={useBackup ? "Each backup code works once." : "From your authenticator app."}
        required
      >
        {(c) => (
          <Input
            name="code"
            inputMode={useBackup ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            required
            {...c}
          />
        )}
      </FormField>
      {error ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Verify"}
      </Button>
      <button
        type="button"
        onClick={() => {
          setUseBackup((v) => !v);
          setError(null);
        }}
        className="text-accent block w-full text-center text-sm font-medium hover:underline"
      >
        {useBackup ? "Use my authenticator app instead" : "Use a backup code instead"}
      </button>
    </form>
  );
}
