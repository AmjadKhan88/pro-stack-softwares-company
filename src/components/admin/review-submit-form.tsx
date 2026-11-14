"use client";

import { useActionState } from "react";
import { submitReviewAction, withdrawReviewAction } from "@/features/projects/review-actions";
import type { ReviewState } from "@/features/projects/review";
import { initialProjectActionState } from "@/features/projects/state";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";

export function ReviewSubmitForm({
  deliverableId,
  state,
  clientVisible,
}: {
  deliverableId: string;
  state: ReviewState;
  clientVisible: boolean;
}) {
  const [submitState, submitAction, submitting] = useActionState(
    submitReviewAction,
    initialProjectActionState,
  );
  const [withdrawState, withdrawAction, withdrawing] = useActionState(
    withdrawReviewAction,
    initialProjectActionState,
  );

  if (state === "approved") {
    return (
      <p className="text-success text-sm font-medium">Approved by the client. This deliverable is final.</p>
    );
  }

  if (state === "in_review") {
    return (
      <form action={withdrawAction} aria-busy={withdrawing} className="space-y-2">
        <input type="hidden" name="deliverableId" value={deliverableId} />
        <p className="text-muted-foreground text-sm">Waiting for the client to approve or ask for changes.</p>
        <Button type="submit" variant="outline" size="sm" disabled={withdrawing}>
          Withdraw submission
        </Button>
        {withdrawState.status === "error" ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {withdrawState.message}
          </p>
        ) : null}
      </form>
    );
  }

  if (!clientVisible) {
    return (
      <p className="text-muted-foreground text-sm">
        Show this deliverable to the client to submit it for review.
      </p>
    );
  }

  return (
    <form action={submitAction} noValidate aria-busy={submitting} className="space-y-3">
      <input type="hidden" name="deliverableId" value={deliverableId} />
      <FormField
        id={`review-note-${deliverableId}`}
        label={state === "changes_requested" ? "Note for the next round" : "What should the client review?"}
        hint="They'll see this note with the submission."
        required
      >
        {(c) => <Textarea name="note" rows={3} maxLength={2000} {...c} />}
      </FormField>
      {submitState.status === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {submitState.message}
        </p>
      ) : null}
      {submitState.status === "success" ? (
        <p role="status" className="text-success text-sm font-medium">
          {submitState.message}
        </p>
      ) : null}
      <Button type="submit" variant="accent" size="sm" disabled={submitting}>
        {submitting
          ? "Submitting…"
          : state === "changes_requested"
            ? "Resubmit for review"
            : "Submit for client review"}
      </Button>
    </form>
  );
}
