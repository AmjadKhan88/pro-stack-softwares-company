"use client";

import { useActionState } from "react";
import { initialLinkClientState, linkClientAction } from "@/features/organizations/link-actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";

export function LinkClientForm({
  organizationId,
  candidates,
}: {
  organizationId: string;
  candidates: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(linkClientAction, initialLinkClientState);

  if (candidates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Every client account already belongs to an organization.
      </p>
    );
  }

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <FormField id="link-client" label="Client account" hint="Accounts not linked to any organization yet.">
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
        {pending ? "Linking…" : "Link account"}
      </Button>
    </form>
  );
}
