"use client";

import { useActionState } from "react";
import { archiveAssetAction, restoreAssetAction, updateAltTextAction } from "@/features/media/actions";
import { initialMediaActionState } from "@/features/media/types";
import { Button } from "@/components/ui/button";

export function AltTextForm({ assetId, alt }: { assetId: string; alt: string }) {
  const [state, formAction, pending] = useActionState(updateAltTextAction, initialMediaActionState);
  return (
    <form action={formAction} aria-busy={pending} className="space-y-2">
      <input type="hidden" name="assetId" value={assetId} />
      <label htmlFor={`alt-${assetId}`} className="block text-xs font-medium">
        Description (alt text)
      </label>
      <div className="flex gap-2">
        <input
          id={`alt-${assetId}`}
          name="altText"
          defaultValue={alt}
          maxLength={200}
          className="border-border bg-surface focus-visible:ring-accent/25 h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm focus-visible:ring-4 focus-visible:outline-none"
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          Save
        </Button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-danger text-xs font-medium">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-success text-xs font-medium">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function ArchiveAssetForm({ assetId, archived }: { assetId: string; archived: boolean }) {
  const [state, formAction, pending] = useActionState(
    archived ? restoreAssetAction : archiveAssetAction,
    initialMediaActionState,
  );
  return (
    <form action={formAction} aria-busy={pending} className="space-y-1">
      <input type="hidden" name="assetId" value={assetId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {archived ? "Restore" : "Archive"}
      </Button>
      {state.status === "error" ? (
        <p role="alert" className="text-danger text-xs font-medium">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
