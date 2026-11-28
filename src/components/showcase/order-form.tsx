"use client";

import Link from "next/link";
import { useState } from "react";
import { PAYMENT_METHODS, SUPPORT_WHATSAPP_URL } from "@/config/payments";
import { Button } from "@/components/ui/button";
import { MAX_PROOF_BYTES } from "@/features/showcase/rules";

const INPUT =
  "border-border bg-surface focus-visible:ring-accent/25 h-10 w-full rounded-lg border px-3 text-sm focus-visible:ring-4 focus-visible:outline-none";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-danger text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function OrderForm({
  offerId,
  offerTitle,
  priceLabel,
}: {
  offerId: string;
  offerTitle: string;
  priceLabel: string;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const data = new FormData(event.currentTarget);

    const file = data.get("screenshot");
    const local: Record<string, string> = {};
    if (!(file instanceof File) || file.size === 0)
      local.screenshot = "Please attach your payment screenshot.";
    else if (file.size > MAX_PROOF_BYTES)
      local.screenshot = "That image is too big. Please upload one under 3 MB.";
    else if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      local.screenshot = "Please upload a JPG, PNG or WebP image.";
    if (Object.keys(local).length > 0) {
      setErrors(local);
      setFormError(null);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const response = await fetch("/api/source-orders", { method: "POST", body: data });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reference?: string;
        message?: string;
        fieldErrors?: Record<string, string>;
      } | null;
      if (response.ok && result?.ok && result.reference) {
        setReference(result.reference);
      } else {
        setErrors(result?.fieldErrors ?? {});
        setFormError(result?.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setFormError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <div role="status" className="border-border bg-surface space-y-4 rounded-2xl border p-6">
        <h3 className="text-xl font-semibold tracking-tight">Request sent</h3>
        <p className="text-sm leading-relaxed">
          Your reference is <strong className="tabular-nums">{reference}</strong>. Please keep it.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We check each payment by hand. Once it is confirmed, we email the source code of {offerTitle} to the
          address you entered. If you have a question, message us on WhatsApp and quote your reference.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/showcase" className="text-accent text-sm font-medium hover:underline">
            Back to the showcase
          </Link>
          <a href={SUPPORT_WHATSAPP_URL} className="text-accent text-sm font-medium hover:underline">
            Message us on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={submitting}
      className="border-border bg-surface space-y-5 rounded-2xl border p-6"
    >
      <input type="hidden" name="offerId" value={offerId} />
      {/* A trap for bots: people never see or fill this. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <p className="text-sm">
        Project: <strong>{offerTitle}</strong> · Price: <strong className="tabular-nums">{priceLabel}</strong>
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="order-name" label="Your name" error={errors.name}>
          <input
            id="order-name"
            name="name"
            autoComplete="name"
            className={INPUT}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "order-name-error" : undefined}
          />
        </Field>
        <Field
          id="order-email"
          label="Email"
          hint="We send the source code to this address."
          error={errors.email}
        >
          <input
            id="order-email"
            name="email"
            type="email"
            autoComplete="email"
            className={INPUT}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "order-email-error" : undefined}
          />
        </Field>
        <Field
          id="order-phone"
          label="WhatsApp number (optional)"
          hint="So we can reach you quickly if needed."
          error={errors.phone}
        >
          <input
            id="order-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={INPUT}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "order-phone-error" : undefined}
          />
        </Field>
        <Field
          id="order-ref"
          label="Transaction ID (optional)"
          hint="Helps us find your payment faster."
          error={errors.transactionRef}
        >
          <input
            id="order-ref"
            name="transactionRef"
            className={INPUT}
            aria-invalid={Boolean(errors.transactionRef)}
            aria-describedby={errors.transactionRef ? "order-ref-error" : undefined}
          />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium">How did you pay?</legend>
        <div className="flex flex-wrap gap-4">
          {PAYMENT_METHODS.map((method) => (
            <label key={method.id} className="flex items-center gap-2 text-sm">
              <input type="radio" name="paymentMethod" value={method.id} />
              {method.label}
            </label>
          ))}
        </div>
        {errors.paymentMethod ? (
          <p role="alert" className="text-danger text-xs font-medium">
            {errors.paymentMethod}
          </p>
        ) : null}
      </fieldset>

      <Field
        id="order-screenshot"
        label="Payment screenshot"
        hint="JPG, PNG or WebP, up to 3 MB. Please make sure the amount and date are visible."
        error={errors.screenshot}
      >
        <input
          id="order-screenshot"
          name="screenshot"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm"
          aria-invalid={Boolean(errors.screenshot)}
          aria-describedby={errors.screenshot ? "order-screenshot-error" : undefined}
        />
      </Field>

      <Field id="order-note" label="Note (optional)" error={errors.note}>
        <textarea
          id="order-note"
          name="note"
          rows={3}
          maxLength={500}
          className="border-border bg-surface focus-visible:ring-accent/25 w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-4 focus-visible:outline-none"
        />
      </Field>

      <div className="space-y-1.5">
        <label className="flex items-start gap-2 text-sm leading-relaxed">
          <input type="checkbox" name="agree" className="mt-1" />
          <span>
            I understand my payment is checked by hand and the source code is emailed to me after it is
            confirmed.
          </span>
        </label>
        {errors.agree ? (
          <p role="alert" className="text-danger text-xs font-medium">
            {errors.agree}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {formError}
        </p>
      ) : null}
      <Button type="submit" variant="accent" disabled={submitting}>
        {submitting ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
