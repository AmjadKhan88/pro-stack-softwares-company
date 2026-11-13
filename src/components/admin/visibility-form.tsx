"use client";

import { useActionState } from "react";
import { visibilityAction } from "@/features/projects/actions";
import { initialProjectActionState } from "@/features/projects/state";
import { Button } from "@/components/ui/button";
import type { ItemKind } from "@/features/projects/status";

export function VisibilityForm({ kind, id, visible }: { kind: ItemKind; id: string; visible: boolean }) {
  const [state, formAction, pending] = useActionState(visibilityAction, initialProjectActionState);

  return (
    <form action={formAction} aria-busy={pending} className="flex items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        name="visible"
        value={String(!visible)}
        variant="ghost"
        size="sm"
        disabled={pending}
      >
        {visible ? "Hide from client" : "Show to client"}
      </Button>
      {state.status === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
