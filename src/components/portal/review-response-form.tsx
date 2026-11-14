"use client";

import { useActionState } from "react";
import { respondToReviewAction } from "@/features/projects/review-client-actions";
import { initialReviewResponseState } from "@/features/projects/review-schema";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";

export function ReviewResponseForm({ deliverableId }: { deliverableId: string }) {
  const [state, formAction, pending] = useActionState(respondToReviewAction, initialReviewResponseState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-3">
      <input type="hidden" name="deliverableId" value={deliverableId} />
      <FormField
        id={`review-comment-${deliverableId}`}
        label="Comment"
        hint="Optional if you approve. Required if you ask for changes."
        error={errors.comment}
      >
        {(c) => <Textarea name="comment" rows={3} maxLength={2000} {...c} />}
      </FormField>
      {state.status === "error" && !state.fieldErrors?.comment ? (
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
        <Button type="submit" name="decision" value="approve" variant="accent" size="sm" disabled={pending}>
          Approve
        </Button>
        <Button
          type="submit"
          name="decision"
          value="request_changes"
          variant="outline"
          size="sm"
          disabled={pending}
        >
          Request changes
        </Button>
      </div>
    </form>
  );
}
