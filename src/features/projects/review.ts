// Deliverable review as a small, pure state machine (no I/O).

export const REVIEW_STATES = ["not_submitted", "in_review", "changes_requested", "approved"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export type ReviewActor = "staff" | "client";

export const STAFF_REVIEW_LABELS: Record<ReviewState, string> = {
  not_submitted: "Not submitted",
  in_review: "With the client",
  changes_requested: "Changes requested",
  approved: "Approved by client",
};

export const CLIENT_REVIEW_LABELS: Record<ReviewState, string> = {
  not_submitted: "Not ready yet",
  in_review: "Ready for your review",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const REVIEW_TONE: Record<ReviewState, "draft" | "review" | "blocked" | "live"> = {
  not_submitted: "draft",
  in_review: "review",
  changes_requested: "blocked",
  approved: "live",
};

// Who may make which move. Staff submit and withdraw; only the client approves or asks for changes.
// Approved is final.
const MOVES: Record<ReviewActor, Record<ReviewState, readonly ReviewState[]>> = {
  staff: {
    not_submitted: ["in_review"],
    in_review: ["not_submitted"],
    changes_requested: ["in_review"],
    approved: [],
  },
  client: {
    not_submitted: [],
    in_review: ["approved", "changes_requested"],
    changes_requested: [],
    approved: [],
  },
};

export function isReviewState(value: unknown): value is ReviewState {
  return typeof value === "string" && (REVIEW_STATES as readonly string[]).includes(value);
}

/** Deliverables created before reviews existed have no review field: they count as "not submitted". */
export function normalizeReviewState(value: unknown): ReviewState {
  return isReviewState(value) ? value : "not_submitted";
}

export function canMoveReview(from: ReviewState, to: ReviewState, by: ReviewActor): boolean {
  return MOVES[by][from].includes(to);
}

export type SubmitCheck =
  { ok: true } | { ok: false; reason: "not-visible" | "project-closed" | "invalid-transition" };

/** A deliverable can go to the client only if they can see it, the project is open and the state allows it. */
export function canSubmitForReview(input: {
  reviewState: ReviewState;
  clientVisible: boolean;
  projectOpen: boolean;
}): SubmitCheck {
  if (!input.projectOpen) return { ok: false, reason: "project-closed" };
  if (!input.clientVisible) return { ok: false, reason: "not-visible" };
  if (!canMoveReview(input.reviewState, "in_review", "staff"))
    return { ok: false, reason: "invalid-transition" };
  return { ok: true };
}

/**
 * Mongo filter value for "the deliverable is currently in this state". Old documents have no field at all, and
 * `null` matches a missing field, so "not_submitted" must also match those.
 */
export function reviewStateFilter(state: ReviewState): ReviewState | { $in: (ReviewState | null)[] } {
  return state === "not_submitted" ? { $in: ["not_submitted", null] } : state;
}

export type ReviewEventType = "submitted" | "withdrawn" | "approved" | "changes_requested";

export const REVIEW_EVENT_LABELS: Record<ReviewEventType, string> = {
  submitted: "Submitted for review",
  withdrawn: "Submission withdrawn",
  approved: "Approved",
  changes_requested: "Changes requested",
};
