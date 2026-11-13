"use client";

import { useActionState } from "react";
import { convertProposalAction } from "@/features/projects/actions";
import { initialProjectActionState } from "@/features/projects/state";
import { Button } from "@/components/ui/button";

export function ConvertProposalForm({ proposalId }: { proposalId: string }) {
  const [state, formAction, pending] = useActionState(convertProposalAction, initialProjectActionState);

  return (
    <form action={formAction} aria-busy={pending} className="space-y-3">
      <input type="hidden" name="proposalId" value={proposalId} />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Creates the project for the client, copies the proposal&apos;s deliverables into it and marks the lead
        as won. This can only be done once.
      </p>
      {state.status === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Creating project…" : "Convert to project"}
      </Button>
    </form>
  );
}
