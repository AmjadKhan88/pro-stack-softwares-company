"use client";

import { useActionState } from "react";
import { archiveFileAction, fileVisibilityAction, restoreFileAction } from "@/features/files/actions";
import { initialFileActionState } from "@/features/files/types";
import { Button } from "@/components/ui/button";

export function FileVisibilityForm({ fileId, visible }: { fileId: string; visible: boolean }) {
  const [state, formAction, pending] = useActionState(fileVisibilityAction, initialFileActionState);
  return (
    <form action={formAction} aria-busy={pending} className="flex items-center gap-2">
      <input type="hidden" name="fileId" value={fileId} />
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
        <span role="alert" className="text-danger text-xs font-medium">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function FileArchiveForm({ fileId, archived }: { fileId: string; archived: boolean }) {
  const [state, formAction, pending] = useActionState(
    archived ? restoreFileAction : archiveFileAction,
    initialFileActionState,
  );
  return (
    <form action={formAction} aria-busy={pending} className="flex items-center gap-2">
      <input type="hidden" name="fileId" value={fileId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {archived ? "Restore" : "Archive"}
      </Button>
      {state.status === "error" ? (
        <span role="alert" className="text-danger text-xs font-medium">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
