"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { changeOrderStatusAction, deleteProofAction } from "@/features/showcase/order-actions";
import type { OrderStatus } from "@/features/showcase/rules";
import { initialActionState } from "@/features/showcase/types";

const BUTTONS: Record<OrderStatus, { label: string; variant: "accent" | "outline"; confirm?: string }> = {
  approved: { label: "Approve payment", variant: "accent" },
  pending: { label: "Set back to pending", variant: "outline" },
  sent: {
    label: "Mark as sent",
    variant: "accent",
    confirm: "Mark this as sent? You can't change it afterwards.",
  },
  rejected: {
    label: "Reject",
    variant: "outline",
    confirm: "Reject this request? The buyer will be emailed.",
  },
};

export function OrderActions({
  orderId,
  allowed,
  canDeleteProof,
}: {
  orderId: string;
  allowed: OrderStatus[];
  canDeleteProof: boolean;
}) {
  const [state, formAction, pending] = useActionState(changeOrderStatusAction, initialActionState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteProofAction, initialActionState);

  return (
    <div className="space-y-6">
      {allowed.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          This request is finished. No further changes are possible.
        </p>
      ) : (
        <form action={formAction} aria-busy={pending} className="space-y-3">
          <input type="hidden" name="id" value={orderId} />
          <div className="space-y-1.5">
            <label htmlFor="status-note" className="block text-[13px] font-medium">
              Note (required to reject)
            </label>
            <textarea
              id="status-note"
              name="note"
              rows={2}
              maxLength={300}
              className="border-border bg-surface focus-visible:ring-accent/25 w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-4 focus-visible:outline-none"
            />
            <p className="text-muted-foreground text-xs">
              Saved in the history for your team. It is not sent to the buyer.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {allowed.map((status) => {
              const button = BUTTONS[status];
              return (
                <Button
                  key={status}
                  type="submit"
                  name="to"
                  value={status}
                  variant={button.variant}
                  size="sm"
                  disabled={pending}
                  onClick={(event) => {
                    if (button.confirm && !window.confirm(button.confirm)) event.preventDefault();
                  }}
                >
                  {button.label}
                </Button>
              );
            })}
          </div>
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
        </form>
      )}

      {canDeleteProof ? (
        <form action={deleteAction} aria-busy={deleting} className="space-y-2">
          <input type="hidden" name="id" value={orderId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={deleting}
            onClick={(event) => {
              if (!window.confirm("Delete the payment screenshot? This can't be undone."))
                event.preventDefault();
            }}
          >
            Delete screenshot
          </Button>
          {deleteState.status === "error" ? (
            <p role="alert" className="text-danger text-sm font-medium">
              {deleteState.message}
            </p>
          ) : null}
          {deleteState.status === "success" ? (
            <p role="status" className="text-success text-sm font-medium">
              {deleteState.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
