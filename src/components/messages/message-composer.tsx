"use client";

import { useActionState } from "react";
import { sendMessageAction } from "@/features/messages/actions";
import { initialMessageState } from "@/features/messages/state";
import { Button } from "@/components/ui/button";

export function MessageComposer({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(sendMessageAction, initialMessageState);
  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <label htmlFor="message-body" className="block text-[13px] font-medium">
        Write a message
      </label>
      <textarea
        id="message-body"
        name="body"
        rows={4}
        maxLength={4000}
        // A message that failed to send stays in the box so nothing typed is lost.
        defaultValue={state.status === "error" ? (state.body ?? "") : ""}
        className="border-border bg-surface focus-visible:ring-accent/25 w-full rounded-lg border px-3 py-2 text-sm leading-relaxed focus-visible:ring-4 focus-visible:outline-none"
      />
      {state.status === "error" ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-success text-sm font-medium">
          Sent.
        </p>
      ) : null}
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
