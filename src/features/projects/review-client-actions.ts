"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClientContext } from "@/features/organizations/context";
import { logger } from "@/server/logger";
import {
  CLIENT_REVIEW_FIELDS,
  clientReviewSchema,
  pickFields,
  type ReviewResponseState,
} from "./review-schema";
import { clientRespondToReview } from "./review-service";

/**
 * A client approves a deliverable or asks for changes. The organization comes from their signed-in account,
 * never from the form, so a forged deliverable id from another organization simply finds nothing.
 */
export async function respondToReviewAction(
  _previous: ReviewResponseState,
  formData: FormData,
): Promise<ReviewResponseState> {
  const { user, organization } = await requireClientContext("/portal/projects");
  if (!organization) return { status: "error", message: "Your account isn't linked to an organization yet." };

  const parsed = clientReviewSchema.safeParse(pickFields(formData, CLIENT_REVIEW_FIELDS));
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Please check your answer.",
      fieldErrors: { comment: fieldErrors.comment?.[0] },
    };
  }

  try {
    const result = await clientRespondToReview({
      organizationId: organization.id,
      user: { id: user.id, email: user.email, name: user.name },
      deliverableId: parsed.data.deliverableId,
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });
    if (!result.ok) {
      return {
        status: "error",
        message: "This deliverable isn't open for review right now. It may already have been answered.",
      };
    }
    revalidatePath("/portal/projects", "layout");
    revalidatePath("/admin/projects", "layout");
    return {
      status: "success",
      message:
        parsed.data.decision === "approve"
          ? "Thank you. You've approved this deliverable."
          : "Thank you. We've received your requested changes.",
    };
  } catch (error) {
    logger.error({ err: error }, "responding to review failed");
    return { status: "error", message: "We couldn't record your answer. Please try again." };
  }
}
