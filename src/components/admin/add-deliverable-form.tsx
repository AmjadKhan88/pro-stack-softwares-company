"use client";

import { useActionState } from "react";
import { addDeliverableAction } from "@/features/projects/actions";
import { initialProjectActionState } from "@/features/projects/state";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function AddDeliverableForm({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState(addDeliverableAction, initialProjectActionState);

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="dl-title" label="Deliverable" required>
          {(c) => <Input name="title" maxLength={200} {...c} />}
        </FormField>
        <FormField id="dl-milestone" label="Milestone" hint="Optional.">
          {(c) => (
            <Select name="milestoneId" defaultValue="" {...c}>
              <option value="">None</option>
              {milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.title}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>
      <FormField id="dl-desc" label="Description" hint="Optional.">
        {(c) => <Textarea name="description" rows={2} maxLength={1000} {...c} />}
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="clientVisible" />
        Visible to the client
      </label>
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
        {pending ? "Adding…" : "Add deliverable"}
      </Button>
    </form>
  );
}
