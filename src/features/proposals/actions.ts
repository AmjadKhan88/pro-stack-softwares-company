"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthEnv } from "@/lib/env";
import { listMembers } from "@/features/organizations/service";
import { logger } from "@/server/logger";
import { ForbiddenError, assertPermission } from "@/server/auth/session";
import { sendEmailInBackground } from "@/server/email/send";
import { proposalSentEmail } from "@/server/email/templates";
import { Organization } from "@/features/organizations/models/organization";
import { connectToDatabase } from "@/server/db/mongoose";
import {
  CREATE_FIELDS,
  PROPOSAL_FIELDS,
  TRANSITION_FIELDS,
  UPDATE_FIELDS,
  createProposalSchema,
  pickFields,
  proposalIdSchema,
  proposalInputSchema,
  staffTransitionSchema,
  type ProposalField,
} from "./schema";
import type { ProposalActionState, ProposalFormState, ProposalFormValues } from "./state";
import { createProposalFromLead, transitionProposalByStaff, updateDraftProposal } from "./service";

function fieldErrorsOf(error: z.ZodError): Partial<Record<ProposalField, string>> {
  const { fieldErrors } = z.flattenError(error);
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, messages]) => [key, (messages as string[] | undefined)?.[0]]),
  ) as Partial<Record<ProposalField, string>>;
}

function contentOf(formData: FormData): ProposalFormValues {
  return pickFields(formData, PROPOSAL_FIELDS);
}

export async function createProposalAction(
  _previous: ProposalFormState,
  formData: FormData,
): Promise<ProposalFormState> {
  const values: ProposalFormValues = { ...pickFields(formData, CREATE_FIELDS) };
  let createdId: string;
  try {
    const actor = await assertPermission("proposals.manage");
    const lead = createProposalSchema.safeParse({ leadId: values.leadId });
    if (!lead.success) return { status: "error", message: "That lead isn't valid.", values };
    const content = proposalInputSchema.safeParse(contentOf(formData));
    if (!content.success) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: fieldErrorsOf(content.error),
        values,
      };
    }
    const result = await createProposalFromLead({
      leadId: lead.data.leadId,
      content: content.data,
      actor: { id: actor.id, email: actor.email },
    });
    if (!result.ok) {
      const messages = {
        "lead-not-found": "That lead no longer exists.",
        "lead-not-qualified": "Only qualified leads can get a proposal.",
        "lead-needs-organization": "Create the client organization for this lead first.",
        "open-proposal-exists": "This lead already has a draft or sent proposal.",
      } as const;
      return { status: "error", message: messages[result.reason], values };
    }
    createdId = result.id;
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message, values };
    logger.error({ err: error }, "creating proposal failed");
    return { status: "error", message: "We couldn't save the proposal. Please try again.", values };
  }
  revalidatePath("/admin/proposals");
  redirect(`/admin/proposals/${createdId}`);
}

export async function updateProposalAction(
  _previous: ProposalFormState,
  formData: FormData,
): Promise<ProposalFormState> {
  const values: ProposalFormValues = { ...pickFields(formData, UPDATE_FIELDS) };
  let proposalId: string;
  try {
    await assertPermission("proposals.manage");
    const id = proposalIdSchema.safeParse({ proposalId: values.proposalId });
    if (!id.success) return { status: "error", message: "That proposal isn't valid.", values };
    const content = proposalInputSchema.safeParse(contentOf(formData));
    if (!content.success) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: fieldErrorsOf(content.error),
        values,
      };
    }
    const result = await updateDraftProposal({ id: id.data.proposalId, content: content.data });
    if (!result.ok) {
      return {
        status: "error",
        message:
          result.reason === "not-editable"
            ? "Only a draft can be edited. Reopen it as a draft first."
            : "That proposal no longer exists.",
        values,
      };
    }
    proposalId = id.data.proposalId;
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message, values };
    logger.error({ err: error }, "updating proposal failed");
    return { status: "error", message: "We couldn't save the changes. Please try again.", values };
  }
  revalidatePath("/admin/proposals");
  revalidatePath(`/admin/proposals/${proposalId}`);
  redirect(`/admin/proposals/${proposalId}`);
}

/** Send, withdraw or reopen. Staff can never accept or decline: only the client's own action can. */
export async function transitionProposalAction(
  _previous: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  try {
    const actor = await assertPermission("proposals.manage");
    const parsed = staffTransitionSchema.safeParse(pickFields(formData, TRANSITION_FIELDS));
    if (!parsed.success) return { status: "error", message: "That action isn't valid." };

    const result = await transitionProposalByStaff({
      id: parsed.data.proposalId,
      to: parsed.data.to,
      actor: { id: actor.id, email: actor.email },
    });
    if (!result.ok) {
      const messages = {
        "not-found": "That proposal no longer exists.",
        "invalid-transition": "That action isn't available for the proposal's current status.",
        "changed-elsewhere": "Someone else just changed this proposal. Reload the page and try again.",
      } as const;
      return { status: "error", message: messages[result.reason] };
    }

    revalidatePath("/admin/proposals");
    revalidatePath(`/admin/proposals/${parsed.data.proposalId}`);
    revalidatePath("/portal/proposals");
    if (parsed.data.to !== "sent") return { status: "success", message: "Done." };

    // Tell the client's people a proposal is waiting. Emails go out after the response; failures are logged.
    await connectToDatabase();
    const organization = await Organization.findById(result.organizationId).lean();
    const members = await listMembers(result.organizationId);
    const url = `${requireAuthEnv().baseURL}/portal/proposals/${parsed.data.proposalId}`;
    const expiresOn = result.expiresAt ? result.expiresAt.toISOString().slice(0, 10) : "the expiry date";
    for (const member of members) {
      if (!member.email) continue;
      await sendEmailInBackground({
        to: member.email,
        ...proposalSentEmail({
          organizationName: organization?.name ?? "your organization",
          title: result.title,
          url,
          expiresOn,
        }),
      });
    }
    return {
      status: "success",
      message:
        members.length > 0
          ? `Sent. ${members.length} ${members.length === 1 ? "person" : "people"} at the client will be emailed.`
          : "Sent, but nobody in this organization has an account yet, so no one was emailed. Invite a client first.",
    };
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "proposal transition failed");
    return { status: "error", message: "We couldn't complete that. Please try again." };
  }
}
