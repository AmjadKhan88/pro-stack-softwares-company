"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/server/logger";
import { ForbiddenError, assertPermission } from "@/server/auth/session";
import { can } from "@/server/policies/permissions";
import {
  LEAD_ID_FIELDS,
  NOTE_FIELDS,
  STATUS_CHANGE_FIELDS,
  leadIdSchema,
  noteSchema,
  pickFields,
  statusChangeSchema,
} from "./admin-schema";
import type { LeadActionState } from "./admin-state";
import { addLeadNote, changeLeadStatus, createOrganizationFromLead } from "./admin-service";

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

function refresh(leadId: string) {
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function changeLeadStatusAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  try {
    const actor = await assertPermission("leads.manage");
    const parsed = statusChangeSchema.safeParse(pickFields(formData, STATUS_CHANGE_FIELDS));
    if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };

    const result = await changeLeadStatus({
      id: parsed.data.leadId,
      to: parsed.data.to,
      note: parsed.data.note,
      actor: { id: actor.id, email: actor.email },
    });
    if (!result.ok) {
      const messages = {
        "not-found": "That lead no longer exists.",
        "invalid-transition": "That status change isn't allowed from the current status.",
        "needs-organization": "Create the client organization before marking this lead as won.",
        "changed-elsewhere": "Someone else just changed this lead. Reload the page and try again.",
      } as const;
      return { status: "error", message: messages[result.reason] };
    }
    refresh(parsed.data.leadId);
    return { status: "success", message: "Status updated." };
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "changing lead status failed");
    return { status: "error", message: "We couldn't update the status. Please try again." };
  }
}

export async function addLeadNoteAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  try {
    const actor = await assertPermission("leads.manage");
    const parsed = noteSchema.safeParse(pickFields(formData, NOTE_FIELDS));
    if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };

    const added = await addLeadNote({
      id: parsed.data.leadId,
      body: parsed.data.body,
      actor: { id: actor.id, email: actor.email },
    });
    if (!added) return { status: "error", message: "That lead no longer exists." };
    refresh(parsed.data.leadId);
    return { status: "success", message: "Note added." };
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "adding lead note failed");
    return { status: "error", message: "We couldn't save the note. Please try again." };
  }
}

export async function createOrganizationFromLeadAction(
  _previous: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  try {
    const actor = await assertPermission("clients.manage");
    if (!can(actor.role, "leads.manage")) return { status: "error", message: "You can't manage leads." };
    const parsed = leadIdSchema.safeParse(pickFields(formData, LEAD_ID_FIELDS));
    if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };

    const result = await createOrganizationFromLead({
      id: parsed.data.leadId,
      actor: { id: actor.id, email: actor.email },
    });
    if (!result.ok) {
      return {
        status: "error",
        message:
          result.reason === "already-linked"
            ? "This lead already has an organization."
            : "That lead no longer exists.",
      };
    }
    refresh(parsed.data.leadId);
    revalidatePath("/admin/clients");
    return { status: "success", message: "Client organization created and linked." };
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "creating organization from lead failed");
    return { status: "error", message: "We couldn't create the organization. Please try again." };
  }
}
