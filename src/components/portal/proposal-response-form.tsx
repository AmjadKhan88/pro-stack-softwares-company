"use client";

import { useActionState } from "react";
import { respondToProposalAction } from "@/features/proposals/client-actions";
import { initialProposalResponseState } from "@/features/proposals/state";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";

export function ProposalResponseForm({
  proposalId,
  organizationName,
}: {
  proposalId: string;
  organizationName: string;
}) {
  const [state, formAction, pending] = useActionState(respondToProposalAction, initialProposalResponseState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-4">
      <input type="hidden" name="proposalId" value={proposalId} />

      <div>
        <label className="flex items-start gap-2 text-sm leading-relaxed">
          <input
            type="checkbox"
            name="authorized"
            aria-describedby={errors.authorized ? "authorized-error" : undefined}
            className="mt-1"
          />
          <span>I am authorized to accept this proposal on behalf of {organizationName}.</span>
        </label>
        {errors.authorized ? (
          <p id="authorized-error" role="alert" className="text-danger mt-1.5 text-sm font-medium">
            {errors.authorized}
          </p>
        ) : null}
      </div>

      <FormField
        id="decline-reason"
        label="Reason for declining"
        hint="Optional. Only used if you decline."
        error={errors.reason}
      >
        {(c) => <Textarea name="reason" rows={3} maxLength={1000} {...c} />}
      </FormField>

      {state.status === "error" && !state.fieldErrors?.authorized && !state.fieldErrors?.reason ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-success text-sm font-medium">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="accept" variant="accent" disabled={pending}>
          Accept proposal
        </Button>
        <Button type="submit" name="decision" value="decline" variant="outline" disabled={pending}>
          Decline
        </Button>
      </div>
    </form>
  );
}
