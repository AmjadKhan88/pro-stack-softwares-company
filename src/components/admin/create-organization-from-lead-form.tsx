"use client";

import { useActionState } from "react";
import { createOrganizationFromLeadAction } from "@/features/leads/admin-actions";
import { initialLeadActionState } from "@/features/leads/admin-state";
import { Button } from "@/components/ui/button";

export function CreateOrganizationFromLeadForm({
  leadId,
  suggestedName,
}: {
  leadId: string;
  suggestedName: string;
}) {
  const [state, formAction, pending] = useActionState(
    createOrganizationFromLeadAction,
    initialLeadActionState,
  );

  return (
    <form action={formAction} aria-busy={pending} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Creates the client organization &ldquo;{suggestedName}&rdquo; and links it to this lead. You can then
        mark the lead as won and invite the client&apos;s people.
      </p>
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
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Creating…" : "Create client organization"}
      </Button>
    </form>
  );
}
