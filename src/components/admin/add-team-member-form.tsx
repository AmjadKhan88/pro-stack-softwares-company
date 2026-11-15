"use client";

import { useActionState } from "react";
import { assignMemberAction } from "@/features/projects/team-actions";
import { initialProjectActionState } from "@/features/projects/state";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";

export function AddTeamMemberForm({
  projectId,
  candidates,
}: {
  projectId: string;
  candidates: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignMemberAction, initialProjectActionState);

  if (candidates.length === 0) {
    return <p className="text-muted-foreground text-sm">Everyone who can be added is already on the team.</p>;
  }

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <FormField id="team-member" label="Team member">
        {(c) => (
          <Select name="userId" defaultValue="" {...c}>
            <option value="" disabled>
              Select…
            </option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </Select>
        )}
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
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add to team"}
      </Button>
    </form>
  );
}
