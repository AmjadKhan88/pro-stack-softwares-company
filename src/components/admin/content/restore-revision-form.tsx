"use client";

import { useActionState } from "react";
import { restoreRevisionAction } from "@/features/cms/actions";
import { initialContentActionState } from "@/features/cms/state";
import { Button } from "@/components/ui/button";

export function RestoreRevisionForm({
  entryId,
  revisionId,
  version,
}: {
  entryId: string;
  revisionId: string;
  version: number;
}) {
  const [state, formAction, pending] = useActionState(restoreRevisionAction, initialContentActionState);
  return (
    <form action={formAction} aria-busy={pending} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Restore to draft
      </Button>
      {state.status === "error" ? (
        <span role="alert" className="text-danger text-xs font-medium">
          {state.message}
        </span>
      ) : null}
      {state.status === "success" ? (
        <span role="status" className="text-success text-xs font-medium">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
