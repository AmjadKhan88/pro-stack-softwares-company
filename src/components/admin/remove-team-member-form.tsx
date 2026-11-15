"use client";

import { useActionState } from "react";
import { removeMemberAction } from "@/features/projects/team-actions";
import { initialProjectActionState } from "@/features/projects/state";
import { Button } from "@/components/ui/button";

export function RemoveTeamMemberForm({
  projectId,
  userId,
  name,
}: {
  projectId: string;
  userId: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(removeMemberAction, initialProjectActionState);

  return (
    <form action={formAction} aria-busy={pending} className="flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="userId" value={userId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={`Remove ${name} from the team`}
      >
        Remove
      </Button>
      {state.status === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
