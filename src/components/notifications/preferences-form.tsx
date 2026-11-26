"use client";

import { useActionState } from "react";
import { savePreferencesAction } from "@/features/notifications/actions";
import { initialPreferencesState } from "@/features/notifications/types";
import { Button } from "@/components/ui/button";

export function PreferencesForm({
  options,
}: {
  options: { key: string; label: string; description: string; checked: boolean }[];
}) {
  const [state, formAction, pending] = useActionState(savePreferencesAction, initialPreferencesState);
  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      <ul className="space-y-3">
        {options.map((option) => (
          <li key={option.key}>
            <label className="flex items-start gap-2 text-sm leading-relaxed">
              <input type="checkbox" name={option.key} defaultChecked={option.checked} className="mt-1" />
              <span>
                <span className="font-medium">{option.label}</span>
                <span className="text-muted-foreground block text-xs">{option.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
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
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
