"use client";

import { useActionState } from "react";
import { inviteUser } from "@/features/invitations/actions";
import { ROLE_LABELS, type InvitableRole } from "@/features/invitations/rules";
import { initialInviteState } from "@/features/invitations/state";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function InviteForm({ roles }: { roles: InvitableRole[] }) {
  const [state, formAction, pending] = useActionState(inviteUser, initialInviteState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <FormField id="invite-email" label="Email address" error={errors.email} required>
          {(c) => <Input name="email" type="email" autoComplete="off" maxLength={254} {...c} />}
        </FormField>
        <FormField id="invite-role" label="Role" error={errors.role} required>
          {(c) => (
            <Select name="role" defaultValue="" {...c}>
              <option value="" disabled>
                Select…
              </option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          )}
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
        {pending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}
