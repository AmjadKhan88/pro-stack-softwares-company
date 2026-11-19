"use client";

import { useActionState } from "react";
import {
  archiveContentAction,
  publishContentAction,
  unarchiveContentAction,
  unpublishContentAction,
} from "@/features/cms/actions";
import { initialContentActionState, type ContentActionState } from "@/features/cms/state";
import type { ContentStatus } from "@/features/cms/types";
import { Button } from "@/components/ui/button";

function Message({ state }: { state: ContentActionState }) {
  if (state.status === "error") {
    return (
      <div role="alert" className="text-danger space-y-1 text-sm font-medium">
        <p>{state.message}</p>
        {state.problems ? (
          <ul className="list-disc space-y-0.5 pl-5 font-normal">
            {state.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (state.status === "success") {
    return (
      <p role="status" className="text-success text-sm font-medium">
        {state.message}
      </p>
    );
  }
  return null;
}

export function ContentLifecycle({
  entryId,
  status,
  version,
  hasUnpublishedChanges,
  canEdit,
  canPublish,
}: {
  entryId: string;
  status: ContentStatus;
  version: number;
  hasUnpublishedChanges: boolean;
  canEdit: boolean;
  canPublish: boolean;
}) {
  const [publish, publishAction, publishing] = useActionState(
    publishContentAction,
    initialContentActionState,
  );
  const [unpublish, unpublishAction, unpublishing] = useActionState(
    unpublishContentAction,
    initialContentActionState,
  );
  const [archive, archiveAction, archiving] = useActionState(archiveContentAction, initialContentActionState);
  const [unarchive, unarchiveAction, unarchiving] = useActionState(
    unarchiveContentAction,
    initialContentActionState,
  );

  const showPublish = canPublish && status !== "archived" && (status === "draft" || hasUnpublishedChanges);

  return (
    <div className="space-y-5">
      {showPublish ? (
        <form action={publishAction} aria-busy={publishing} className="space-y-2">
          <input type="hidden" name="entryId" value={entryId} />
          <input type="hidden" name="expectedVersion" value={version} />
          <p className="text-muted-foreground text-sm leading-relaxed">
            {status === "draft"
              ? "Publishing makes the saved draft public. Save your changes first."
              : "Publishing makes your saved changes public."}
          </p>
          <Button type="submit" variant="accent" disabled={publishing}>
            {publishing ? "Publishing…" : status === "draft" ? "Publish" : "Publish changes"}
          </Button>
          <Message state={publish} />
        </form>
      ) : null}

      {!canPublish && status !== "archived" ? (
        <p className="text-muted-foreground text-sm">
          Only people with publishing rights can publish or unpublish.
        </p>
      ) : null}

      {canPublish && status === "published" ? (
        <form action={unpublishAction} aria-busy={unpublishing} className="space-y-2">
          <input type="hidden" name="entryId" value={entryId} />
          <p className="text-muted-foreground text-sm leading-relaxed">
            Unpublishing removes it from the website. The draft is kept.
          </p>
          <Button type="submit" variant="outline" disabled={unpublishing}>
            Unpublish
          </Button>
          <Message state={unpublish} />
        </form>
      ) : null}

      {canEdit && status === "draft" ? (
        <form action={archiveAction} aria-busy={archiving} className="space-y-2">
          <input type="hidden" name="entryId" value={entryId} />
          <Button type="submit" variant="ghost" size="sm" disabled={archiving}>
            Archive
          </Button>
          <Message state={archive} />
        </form>
      ) : null}

      {canEdit && status === "archived" ? (
        <form action={unarchiveAction} aria-busy={unarchiving} className="space-y-2">
          <input type="hidden" name="entryId" value={entryId} />
          <p className="text-muted-foreground text-sm">This item is archived and can't be edited.</p>
          <Button type="submit" variant="outline" disabled={unarchiving}>
            Restore as a draft
          </Button>
          <Message state={unarchive} />
        </form>
      ) : null}
    </div>
  );
}
