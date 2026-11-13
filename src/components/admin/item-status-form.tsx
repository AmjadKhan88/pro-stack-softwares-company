"use client";

import { useActionState } from "react";
import { itemStatusAction } from "@/features/projects/actions";
import { initialProjectActionState } from "@/features/projects/state";
import { ITEM_MOVE_LABELS, itemMovesFrom, type ItemKind } from "@/features/projects/status";
import { Button } from "@/components/ui/button";

export function ItemStatusForm({ kind, id, status }: { kind: ItemKind; id: string; status: string }) {
  const [state, formAction, pending] = useActionState(itemStatusAction, initialProjectActionState);
  const moves = itemMovesFrom(kind, status);
  if (moves.length === 0) return null;

  return (
    <form action={formAction} aria-busy={pending} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      {moves.map((to) => (
        <Button key={to} type="submit" name="to" value={to} variant="outline" size="sm" disabled={pending}>
          {ITEM_MOVE_LABELS[to] ?? to}
        </Button>
      ))}
      {state.status === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
