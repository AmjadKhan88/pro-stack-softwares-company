"use client";

import { useActionState } from "react";
import { transitionProposalAction } from "@/features/proposals/actions";
import { initialProposalActionState } from "@/features/proposals/state";
import { staffMovesFrom, type ProposalStatus } from "@/features/proposals/status";
import { Button } from "@/components/ui/button";

const LABELS: Partial<Record<ProposalStatus, string>> = {
  sent: "Send to client",
  withdrawn: "Withdraw",
  draft: "Reopen as draft",
};

export function ProposalStatusActions({
  proposalId,
  status,
  organizationName,
}: {
  proposalId: string;
  status: ProposalStatus;
  organizationName: string | null;
}) {
  const [state, formAction, pending] = useActionState(transitionProposalAction, initialProposalActionState);
  const moves = staffMovesFrom(status);

  if (moves.length === 0) {
    return <p className="text-muted-foreground text-sm">No further actions. Accepted proposals are final.</p>;
  }

  return (
    <form action={formAction} aria-busy={pending} className="space-y-3">
      <input type="hidden" name="proposalId" value={proposalId} />
      {status === "draft" ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Sending emails everyone at {organizationName ?? "the client"} and locks the content, so the client
          reads exactly what you sent.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {moves.map((to) => (
          <Button
            key={to}
            type="submit"
            name="to"
            value={to}
            variant={to === "sent" ? "accent" : "outline"}
            disabled={pending}
          >
            {LABELS[to] ?? to}
          </Button>
        ))}
      </div>
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
    </form>
  );
}
