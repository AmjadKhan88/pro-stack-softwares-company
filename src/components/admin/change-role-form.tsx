"use client";

import { useActionState } from "react";
import { changeRoleAction } from "@/features/users/actions";
import { ROLE_LABELS } from "@/features/invitations/rules";
import type { RoleChangeOption } from "@/features/users/rules";
import { initialUserActionState } from "@/features/users/schema";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";

export function ChangeRoleForm({ userId, options }: { userId: string; options: RoleChangeOption[] }) {
  const [state, formAction, pending] = useActionState(changeRoleAction, initialUserActionState);

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <FormField id="new-role" label="New role" required>
        {(c) => (
          <Select name="role" defaultValue="" {...c}>
            <option value="" disabled>
              Select…
            </option>
            {options.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
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
        {pending ? "Saving…" : "Change role"}
      </Button>
    </form>
  );
}
