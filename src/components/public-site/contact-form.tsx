"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitInquiry } from "@/features/leads/actions";
import { initialInquiryState } from "@/features/leads/state";
import {
  BUDGET_RANGES,
  PROJECT_TYPES,
  TIMEFRAMES,
  budgetLabels,
  projectTypeLabels,
  timeframeLabels,
} from "@/features/leads/schema";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitInquiry, initialInquiryState);

  if (state.status === "success") {
    return (
      <div role="status" className="border-border bg-surface rounded-xl border p-6">
        <CheckCircle2 className="text-success size-6" aria-hidden />
        <h2 className="mt-3 text-xl font-semibold tracking-tight">
          Thank you, we&apos;ve received your inquiry.
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          We&apos;ll review it and reply to the email address you provided. Keep this reference if you need to
          follow up:
        </p>
        <p className="bg-surface-muted mt-4 inline-block rounded-lg px-3 py-2 font-mono text-base tracking-wider">
          {state.referenceCode}
        </p>
      </div>
    );
  }

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="name" label="Your name" error={errors.name} required>
          {(c) => <Input name="name" autoComplete="name" maxLength={100} defaultValue={values.name} {...c} />}
        </FormField>
        <FormField id="email" label="Email" error={errors.email} required>
          {(c) => (
            <Input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              defaultValue={values.email}
              {...c}
            />
          )}
        </FormField>
      </div>

      <FormField id="company" label="Company" hint="Optional." error={errors.company}>
        {(c) => (
          <Input
            name="company"
            autoComplete="organization"
            maxLength={120}
            defaultValue={values.company}
            {...c}
          />
        )}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-3">
        <FormField id="projectType" label="Project type" error={errors.projectType} required>
          {(c) => (
            <Select name="projectType" defaultValue={values.projectType ?? ""} {...c}>
              <option value="" disabled>
                Select…
              </option>
              {PROJECT_TYPES.map((v) => (
                <option key={v} value={v}>
                  {projectTypeLabels[v]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField id="budgetRange" label="Budget" hint="Optional." error={errors.budgetRange}>
          {(c) => (
            <Select name="budgetRange" defaultValue={values.budgetRange ?? ""} {...c}>
              <option value="">Prefer not to say</option>
              {BUDGET_RANGES.map((v) => (
                <option key={v} value={v}>
                  {budgetLabels[v]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField id="timeframe" label="Timeframe" hint="Optional." error={errors.timeframe}>
          {(c) => (
            <Select name="timeframe" defaultValue={values.timeframe ?? ""} {...c}>
              <option value="">Not decided</option>
              {TIMEFRAMES.map((v) => (
                <option key={v} value={v}>
                  {timeframeLabels[v]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      <FormField
        id="message"
        label="Project details"
        hint="What problem are you solving, who is it for, and anything that must be included?"
        error={errors.message}
        required
      >
        {(c) => <Textarea name="message" rows={6} maxLength={4000} defaultValue={values.message} {...c} />}
      </FormField>

      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send inquiry"}
      </Button>
    </form>
  );
}
