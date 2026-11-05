"use client";

import { useActionState } from "react";
import { addLeadNoteAction } from "@/features/leads/admin-actions";
import { initialLeadActionState } from "@/features/leads/admin-state";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";

export function LeadNoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addLeadNoteAction, initialLeadActionState);

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <FormField id="lead-note" label="Internal note" hint="Only the team can see notes." required>
        {(c) => <Textarea name="body" rows={3} maxLength={2000} {...c} />}
      </FormField>
      {state.status === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-success text-sm font-medium">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Add note"}
      </Button>
    </form>
  );
}
