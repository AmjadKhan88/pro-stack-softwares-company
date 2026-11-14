"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/server/logger";
import { ForbiddenError, assertPermission } from "@/server/auth/session";
import {
  SUBMIT_FIELDS,
  WITHDRAW_FIELDS,
  pickFields,
  submitReviewSchema,
  withdrawReviewSchema,
} from "./review-schema";
import { submitForReview, withdrawReview, type ReviewResult } from "./review-service";
import type { ProjectActionState } from "./state";

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

const MESSAGES = {
  "not-found": "That deliverable no longer exists.",
  "project-closed": "This project is closed, so it can't be changed.",
  "not-visible": "Show this deliverable to the client before submitting it for review.",
  "invalid-transition": "That isn't available for the deliverable's current review state.",
  "changed-elsewhere": "Someone else just changed this. Reload the page and try again.",
} as const;

function describe(result: ReviewResult, success: string): ProjectActionState {
  return result.ok
    ? { status: "success", message: success }
    : { status: "error", message: MESSAGES[result.reason] };
}

function refresh() {
  revalidatePath("/admin/projects", "layout");
  revalidatePath("/portal/projects", "layout");
}

export async function submitReviewAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  try {
    const actor = await assertPermission("projects.manage");
    const parsed = submitReviewSchema.safeParse(pickFields(formData, SUBMIT_FIELDS));
    if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };
    const result = await submitForReview({
      actor: { id: actor.id, email: actor.email, name: actor.name },
      deliverableId: parsed.data.deliverableId,
      note: parsed.data.note,
    });
    if (result.ok) refresh();
    return describe(result, "Submitted. The client can now review it.");
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "submitting for review failed");
    return { status: "error", message: "We couldn't submit it. Please try again." };
  }
}

export async function withdrawReviewAction(
  _previous: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  try {
    const actor = await assertPermission("projects.manage");
    const parsed = withdrawReviewSchema.safeParse(pickFields(formData, WITHDRAW_FIELDS));
    if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };
    const result = await withdrawReview({
      actor: { id: actor.id, email: actor.email, name: actor.name },
      deliverableId: parsed.data.deliverableId,
    });
    if (result.ok) refresh();
    return describe(result, "Submission withdrawn.");
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "withdrawing review failed");
    return { status: "error", message: "We couldn't withdraw it. Please try again." };
  }
}
