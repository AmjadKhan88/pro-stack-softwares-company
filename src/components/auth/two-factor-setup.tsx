"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { authClient } from "@/lib/auth-client";
import { describeCodeError } from "@/features/auth/messages";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

interface Enrolment {
  totpURI: string;
  backupCodes: string[];
}

function secretFromUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export function TwoFactorSetup({ next }: { next: string }) {
  const router = useRouter();
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const { data, error: failure } = await authClient.twoFactor.enable({ password });
    setPending(false);
    if (failure || !data || data.method !== "totp") {
      setError(
        failure?.status === 429
          ? "Too many attempts. Please wait and try again."
          : "That password isn't correct.",
      );
      return;
    }
    setEnrolment({ totpURI: data.totpURI, backupCodes: data.backupCodes });
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    const { error: failure } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (failure) return setError(describeCodeError(failure));
    router.push(next);
    router.refresh();
  }

  if (!enrolment) {
    return (
      <form onSubmit={start} noValidate aria-busy={pending} className="space-y-5">
        <FormField
          id="password"
          label="Confirm your password"
          hint="We ask again before changing security settings."
          required
        >
          {(c) => <Input name="password" type="password" autoComplete="current-password" required {...c} />}
        </FormField>
        {error ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Starting…" : "Start setup"}
        </Button>
      </form>
    );
  }

  const secret = secretFromUri(enrolment.totpURI);
  return (
    <div className="space-y-6">
      <section aria-labelledby="scan" className="space-y-3">
        <h2 id="scan" className="font-semibold">
          1. Scan with your authenticator app
        </h2>
        <div className="inline-block rounded-lg bg-white p-3">
          <QRCodeSVG
            value={enrolment.totpURI}
            size={176}
            bgColor="#ffffff"
            fgColor="#000000"
            title="Two-factor setup QR code"
          />
        </div>
        {secret ? (
          <p className="text-muted-foreground text-sm">
            Can&apos;t scan? Enter this key manually:{" "}
            <code className="bg-surface-muted rounded px-1.5 py-0.5 font-mono break-all">{secret}</code>
          </p>
        ) : null}
      </section>

      <section aria-labelledby="backup" className="space-y-3">
        <h2 id="backup" className="font-semibold">
          2. Save your backup codes
        </h2>
        <p className="text-muted-foreground text-sm">
          If you lose your phone, each code lets you in once. They are shown only now. Store them somewhere
          safe.
        </p>
        <ul className="bg-surface-muted grid grid-cols-2 gap-2 rounded-lg p-3 font-mono text-sm">
          {enrolment.backupCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(enrolment.backupCodes.join("\n"));
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy codes"}
        </Button>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="mt-1"
          />
          I have saved my backup codes
        </label>
      </section>

      <form onSubmit={confirm} noValidate aria-busy={pending} className="space-y-4">
        <h2 className="font-semibold">3. Enter the 6-digit code</h2>
        <FormField id="code" label="Code from your app" required>
          {(c) => (
            <Input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={!saved}
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
        <Button type="submit" size="lg" className="w-full" disabled={!saved || pending}>
          {pending ? "Verifying…" : "Turn on two-factor"}
        </Button>
      </form>
    </div>
  );
}
