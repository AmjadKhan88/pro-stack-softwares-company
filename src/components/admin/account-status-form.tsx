"use client";

import { useActionState } from "react";
import { accountStatusAction } from "@/features/users/actions";
import { initialUserActionState } from "@/features/users/schema";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";

export function AccountStatusForm({ userId, disabled }: { userId: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(accountStatusAction, initialUserActionState);

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      {disabled ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          This account is disabled and can't sign in. Re-enabling lets them sign in again with their existing
          password.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Disabling signs them out everywhere straight away and stops them signing in. Their work and
            history stay.
          </p>
          <FormField id="disable-reason" label="Reason" hint="Optional. Kept in the audit log.">
            {(c) => <Textarea name="reason" rows={2} maxLength={200} {...c} />}
          </FormField>
        </>
      )}
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
      <Button
        type="submit"
        name="action"
        value={disabled ? "enable" : "disable"}
        variant={disabled ? "accent" : "outline"}
        size="sm"
        disabled={pending}
      >
        {disabled ? "Re-enable account" : "Disable account"}
      </Button>
    </form>
  );
}
