"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "@/features/organizations/actions";
import { initialOrganizationState } from "@/features/organizations/schema";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState(createOrganizationAction, initialOrganizationState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="org-name" label="Organization name" error={errors.name} required>
          {(c) => <Input name="name" maxLength={120} autoComplete="off" {...c} />}
        </FormField>
        <FormField id="org-email" label="Contact email" hint="Optional." error={errors.contactEmail}>
          {(c) => <Input name="contactEmail" type="email" maxLength={254} autoComplete="off" {...c} />}
        </FormField>
      </div>
      {state.status === "error" && !state.fieldErrors ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="border-success/30 bg-success/10 rounded-lg border px-3 py-2 text-sm">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
