"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitProjectRequestAction } from "@/features/leads/request-actions";
import { initialRequestState } from "@/features/leads/request-schema";
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
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function RequestForm() {
  const [state, formAction, pending] = useActionState(submitProjectRequestAction, initialRequestState);

  if (state.status === "success") {
    return (
      <div role="status" className="border-border bg-surface rounded-xl border p-6">
        <CheckCircle2 className="text-success size-6" aria-hidden />
        <h2 className="mt-3 text-xl font-semibold tracking-tight">
          Thank you, we&apos;ve received your request.
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          We&apos;ll review it and get back to you. Your reference:
        </p>
        <p className="bg-surface-muted mt-4 inline-block rounded-lg px-3 py-2 font-mono text-base tracking-wider">
          {state.referenceCode}
        </p>
        <p className="mt-4 text-sm">
          <Link href="/portal/requests" className="text-accent font-medium hover:underline">
            See your requests →
          </Link>
        </p>
      </div>
    );
  }

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <FormField id="r-type" label="Project type" error={errors.projectType} required>
          {(c) => (
            <Select name="projectType" defaultValue={values.projectType ?? ""} {...c}>
              <option value="" disabled>
                Select…
              </option>
              {PROJECT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {projectTypeLabels[value]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField id="r-budget" label="Budget" hint="Optional." error={errors.budgetRange}>
          {(c) => (
            <Select name="budgetRange" defaultValue={values.budgetRange ?? ""} {...c}>
              <option value="">Prefer not to say</option>
              {BUDGET_RANGES.map((value) => (
                <option key={value} value={value}>
                  {budgetLabels[value]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField id="r-timeframe" label="Timeframe" hint="Optional." error={errors.timeframe}>
          {(c) => (
            <Select name="timeframe" defaultValue={values.timeframe ?? ""} {...c}>
              <option value="">Not decided</option>
              {TIMEFRAMES.map((value) => (
                <option key={value} value={value}>
                  {timeframeLabels[value]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      <FormField
        id="r-message"
        label="Project details"
        hint="What problem are you solving, who is it for, and anything that must be included?"
        error={errors.message}
        required
      >
        {(c) => <Textarea name="message" rows={7} maxLength={4000} defaultValue={values.message} {...c} />}
      </FormField>

      {state.status === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
