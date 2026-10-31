"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/features/invitations/actions";
import { initialAcceptState } from "@/features/invitations/state";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInvite, initialAcceptState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <FormField id="name" label="Your name" error={errors.name} required>
        {(c) => <Input name="name" autoComplete="name" maxLength={100} {...c} />}
      </FormField>
      <FormField
        id="password"
        label="Choose a password"
        hint="At least 12 characters."
        error={errors.password}
        required
      >
        {(c) => <Input name="password" type="password" autoComplete="new-password" {...c} />}
      </FormField>
      <FormField id="confirm" label="Repeat password" error={errors.confirm} required>
        {(c) => <Input name="confirm" type="password" autoComplete="new-password" {...c} />}
      </FormField>
      {state.status === "error" && !state.fieldErrors ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
