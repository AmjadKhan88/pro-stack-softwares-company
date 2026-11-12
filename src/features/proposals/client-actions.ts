"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClientContext } from "@/features/organizations/context";
import { logger } from "@/server/logger";
import { RESPOND_FIELDS, pickFields, respondSchema } from "./schema";
import { respondToProposal } from "./service";
import type { ProposalResponseState } from "./state";

/**
 * A client answers a proposal. The organization comes from their signed-in account, never from the form,
 * so a forged proposal id from another organization simply finds nothing.
 */
export async function respondToProposalAction(
  _previous: ProposalResponseState,
  formData: FormData,
): Promise<ProposalResponseState> {
  const { user, organization } = await requireClientContext("/portal/proposals");
  if (!organization) {
    return { status: "error", message: "Your account isn't linked to an organization yet." };
  }

  const parsed = respondSchema.safeParse(pickFields(formData, RESPOND_FIELDS));
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Please check your answer.",
      fieldErrors: { authorized: fieldErrors.authorized?.[0], reason: fieldErrors.reason?.[0] },
    };
  }

  try {
    const result = await respondToProposal({
      organizationId: organization.id,
      proposalId: parsed.data.proposalId,
      decision: parsed.data.decision,
      reason: parsed.data.reason,
      user: { id: user.id, email: user.email, name: user.name },
    });
    if (!result.ok) {
      return {
        status: "error",
        message: "This proposal is no longer open for a response. It may have expired or been withdrawn.",
      };
    }
    revalidatePath("/portal/proposals");
    revalidatePath(`/portal/proposals/${parsed.data.proposalId}`);
    revalidatePath("/admin/proposals");
    return {
      status: "success",
      message:
        parsed.data.decision === "accept"
          ? "Thank you. You've accepted the proposal and our team has been notified."
          : "Thank you. Your response has been recorded.",
    };
  } catch (error) {
    logger.error({ err: error }, "responding to proposal failed");
    return { status: "error", message: "We couldn't record your answer. Please try again." };
  }
}
