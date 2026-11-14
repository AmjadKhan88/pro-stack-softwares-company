import { z } from "zod";
import { isObjectId } from "@/lib/object-id";

export { pickFields } from "@/lib/form-fields";

const deliverableId = z.string().refine(isObjectId, "Invalid deliverable.");
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const submitReviewSchema = z.strictObject({
  deliverableId,
  note: z
    .string()
    .trim()
    .min(10, "Describe what the client should review (at least 10 characters).")
    .max(2000, "Keep the note under 2,000 characters."),
});

export const withdrawReviewSchema = z.strictObject({ deliverableId });

/** A client's answer. Asking for changes must say what needs to change. */
export const clientReviewSchema = z
  .strictObject({
    deliverableId,
    decision: z.enum(["approve", "request_changes"], { error: "Choose approve or request changes." }),
    comment: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(2000, "Keep the comment under 2,000 characters.").optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "request_changes" && (data.comment?.length ?? 0) < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: "Tell us what needs to change (at least 10 characters).",
      });
    }
  });

export const SUBMIT_FIELDS = ["deliverableId", "note"] as const;
export const WITHDRAW_FIELDS = ["deliverableId"] as const;
export const CLIENT_REVIEW_FIELDS = ["deliverableId", "decision", "comment"] as const;

export type ReviewResponseState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: { comment?: string } };

export const initialReviewResponseState: ReviewResponseState = { status: "idle" };
