"use client";

import { useActionState } from "react";
import { projectStatusAction } from "@/features/projects/actions";
import { initialProjectActionState } from "@/features/projects/state";
import { PROJECT_STATUS_LABELS, projectMovesFrom, type ProjectStatus } from "@/features/projects/status";
import { Button } from "@/components/ui/button";

export function ProjectStatusForm({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const [state, formAction, pending] = useActionState(projectStatusAction, initialProjectActionState);
  const moves = projectMovesFrom(status);

  if (moves.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">This project is closed. Nothing inside it can change.</p>
    );
  }

  return (
    <form action={formAction} aria-busy={pending} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex flex-wrap gap-2">
        {moves.map((to) => (
          <Button
            key={to}
            type="submit"
            name="to"
            value={to}
            variant={to === "cancelled" ? "outline" : "primary"}
            size="sm"
            disabled={pending}
          >
            Move to {PROJECT_STATUS_LABELS[to].toLowerCase()}
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
