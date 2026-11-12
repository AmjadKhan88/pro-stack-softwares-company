"use client";

import { useActionState } from "react";
import { createProposalAction, updateProposalAction } from "@/features/proposals/actions";
import { CURRENCIES, CURRENCY_LABELS } from "@/features/proposals/money";
import { initialProposalFormState, type ProposalFormValues } from "@/features/proposals/state";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface Props {
  mode: "create" | "edit";
  /** The lead id when creating, the proposal id when editing. */
  targetId: string;
  defaults: ProposalFormValues;
}

export function ProposalForm({ mode, targetId, defaults }: Props) {
  const [state, formAction, pending] = useActionState(
    mode === "create" ? createProposalAction : updateProposalAction,
    initialProposalFormState,
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const v: ProposalFormValues = state.status === "error" && state.values ? state.values : defaults;

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-6">
      <input type="hidden" name={mode === "create" ? "leadId" : "proposalId"} value={targetId} />

      <FormField id="p-title" label="Title" error={errors.title} required>
        {(c) => <Input name="title" maxLength={160} defaultValue={v.title} {...c} />}
      </FormField>
      <FormField
        id="p-summary"
        label="Summary"
        hint="Two or three sentences shown at the top."
        error={errors.summary}
        required
      >
        {(c) => <Textarea name="summary" rows={3} maxLength={600} defaultValue={v.summary} {...c} />}
      </FormField>
      <FormField
        id="p-scope"
        label="Scope"
        hint="What you will build and how the work will run."
        error={errors.scope}
        required
      >
        {(c) => <Textarea name="scope" rows={9} maxLength={8000} defaultValue={v.scope} {...c} />}
      </FormField>
      <FormField
        id="p-deliverables"
        label="Deliverables"
        hint="One per line."
        error={errors.deliverables}
        required
      >
        {(c) => <Textarea name="deliverables" rows={5} defaultValue={v.deliverables} {...c} />}
      </FormField>
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          id="p-assumptions"
          label="Assumptions"
          hint="One per line. Optional."
          error={errors.assumptions}
        >
          {(c) => <Textarea name="assumptions" rows={5} defaultValue={v.assumptions} {...c} />}
        </FormField>
        <FormField
          id="p-exclusions"
          label="Not included"
          hint="One per line. Optional."
          error={errors.exclusions}
        >
          {(c) => <Textarea name="exclusions" rows={5} defaultValue={v.exclusions} {...c} />}
        </FormField>
      </div>

      <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
        <FormField id="p-weeks" label="Estimated weeks" error={errors.estimatedWeeks} required>
          {(c) => <Input name="estimatedWeeks" inputMode="numeric" defaultValue={v.estimatedWeeks} {...c} />}
        </FormField>
        <FormField
          id="p-timeline"
          label="Timeline"
          hint="Key phases and what you need from the client."
          error={errors.timelineSummary}
          required
        >
          {(c) => (
            <Textarea
              name="timelineSummary"
              rows={3}
              maxLength={1000}
              defaultValue={v.timelineSummary}
              {...c}
            />
          )}
        </FormField>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField id="p-currency" label="Currency" error={errors.currency} required>
          {(c) => (
            <Select name="currency" defaultValue={v.currency ?? ""} {...c}>
              <option value="" disabled>
                Select…
              </option>
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {CURRENCY_LABELS[currency]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          id="p-amount"
          label="Total price"
          hint="For example 1500 or 1,500.50."
          error={errors.totalAmount}
          required
        >
          {(c) => <Input name="totalAmount" inputMode="decimal" defaultValue={v.totalAmount} {...c} />}
        </FormField>
      </div>
      <FormField
        id="p-payment"
        label="Payment terms"
        hint="When and how the client pays."
        error={errors.paymentTerms}
        required
      >
        {(c) => (
          <Textarea name="paymentTerms" rows={3} maxLength={1000} defaultValue={v.paymentTerms} {...c} />
        )}
      </FormField>

      {state.status === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? "Saving…" : mode === "create" ? "Save draft" : "Save changes"}
      </Button>
    </form>
  );
}
