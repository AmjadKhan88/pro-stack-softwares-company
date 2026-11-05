"use client";

import { useActionState } from "react";
import { changeLeadStatusAction } from "@/features/leads/admin-actions";
import { initialLeadActionState } from "@/features/leads/admin-state";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/features/leads/pipeline";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function LeadStatusForm({ leadId, options }: { leadId: string; options: LeadStatus[] }) {
  const [state, formAction, pending] = useActionState(changeLeadStatusAction, initialLeadActionState);

  return (
    <form action={formAction} noValidate aria-busy={pending} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <FormField id="lead-status" label="Move to" required>
        {(c) => (
          <Select name="to" defaultValue="" {...c}>
            <option value="" disabled>
              Select…
            </option>
            {options.map((status) => (
              <option key={status} value={status}>
                {LEAD_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField id="lead-status-note" label="Note" hint="Optional. Saved in the history.">
        {(c) => <Textarea name="note" rows={2} maxLength={500} {...c} />}
      </FormField>
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
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update status"}
      </Button>
    </form>
  );
}
