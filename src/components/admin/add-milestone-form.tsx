"use client";

import { useActionState } from "react";
import { addMilestoneAction } from "@/features/projects/actions";
import { initialProjectActionState } from "@/features/projects/state";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";

export function AddMilestoneForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(addMilestoneAction, initialProjectActionState);

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <FormField id="ms-title" label="Milestone" required>
          {(c) => <Input name="title" maxLength={160} {...c} />}
        </FormField>
        <FormField id="ms-due" label="Due date" hint="YYYY-MM-DD. Optional.">
          {(c) => <Input name="dueDate" placeholder="2026-12-31" {...c} />}
        </FormField>
      </div>
      <FormField id="ms-desc" label="Description" hint="Optional.">
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
        {pending ? "Adding…" : "Add milestone"}
      </Button>
    </form>
  );
}
