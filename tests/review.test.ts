import { describe, expect, it } from "vitest";
import {
  REVIEW_STATES,
  canMoveReview,
  canSubmitForReview,
  isReviewState,
  normalizeReviewState,
  reviewStateFilter,
} from "@/features/projects/review";
import {
  CLIENT_REVIEW_FIELDS,
  SUBMIT_FIELDS,
  clientReviewSchema,
  pickFields,
  submitReviewSchema,
  withdrawReviewSchema,
} from "@/features/projects/review-schema";

const ID = "64b7f1c2a3d4e5f60718293a";

describe("review state machine", () => {
  it("lets staff only submit, resubmit and withdraw", () => {
    expect(canMoveReview("not_submitted", "in_review", "staff")).toBe(true);
    expect(canMoveReview("changes_requested", "in_review", "staff")).toBe(true);
    expect(canMoveReview("in_review", "not_submitted", "staff")).toBe(true);
    // Staff can never approve or request changes on the client's behalf.
    for (const from of REVIEW_STATES) {
      expect(canMoveReview(from, "approved", "staff"), `${from}->approved`).toBe(false);
      expect(canMoveReview(from, "changes_requested", "staff"), `${from}->changes_requested`).toBe(false);
    }
  });

  it("lets a client only answer a deliverable that is in review", () => {
    expect(canMoveReview("in_review", "approved", "client")).toBe(true);
    expect(canMoveReview("in_review", "changes_requested", "client")).toBe(true);
    for (const from of REVIEW_STATES.filter((s) => s !== "in_review")) {
      for (const to of REVIEW_STATES) expect(canMoveReview(from, to, "client"), `${from}->${to}`).toBe(false);
    }
  });

  it("treats approved as final for everyone", () => {
    for (const to of REVIEW_STATES) {
      expect(canMoveReview("approved", to, "staff")).toBe(false);
      expect(canMoveReview("approved", to, "client")).toBe(false);
    }
  });

  it("treats missing or unknown values as not submitted", () => {
    expect(normalizeReviewState(undefined)).toBe("not_submitted");
    expect(normalizeReviewState(null)).toBe("not_submitted");
    expect(normalizeReviewState("weird")).toBe("not_submitted");
    expect(normalizeReviewState("in_review")).toBe("in_review");
    expect(isReviewState("approved")).toBe(true);
    expect(isReviewState("done")).toBe(false);
  });

  it("matches old documents with no field when asking for 'not submitted'", () => {
    expect(reviewStateFilter("not_submitted")).toEqual({ $in: ["not_submitted", null] });
    expect(reviewStateFilter("in_review")).toBe("in_review");
  });
});

describe("submitting for review", () => {
  const base = { reviewState: "not_submitted" as const, clientVisible: true, projectOpen: true };

  it("is allowed for a visible deliverable in an open project", () => {
    expect(canSubmitForReview(base)).toEqual({ ok: true });
    expect(canSubmitForReview({ ...base, reviewState: "changes_requested" })).toEqual({ ok: true });
  });

  it("is refused when the client cannot see it, the project is closed or it is already in review or approved", () => {
    expect(canSubmitForReview({ ...base, clientVisible: false })).toEqual({
      ok: false,
      reason: "not-visible",
    });
    expect(canSubmitForReview({ ...base, projectOpen: false })).toEqual({
      ok: false,
      reason: "project-closed",
    });
    expect(canSubmitForReview({ ...base, reviewState: "in_review" })).toEqual({
      ok: false,
      reason: "invalid-transition",
    });
    expect(canSubmitForReview({ ...base, reviewState: "approved" })).toEqual({
      ok: false,
      reason: "invalid-transition",
    });
  });
});

describe("review input", () => {
  it("needs a real note to submit", () => {
    expect(
      submitReviewSchema.safeParse({ deliverableId: ID, note: "Please review the homepage design." }).success,
    ).toBe(true);
    expect(submitReviewSchema.safeParse({ deliverableId: ID, note: "short" }).success).toBe(false);
    expect(submitReviewSchema.safeParse({ deliverableId: ID, note: "x".repeat(2001) }).success).toBe(false);
    expect(submitReviewSchema.safeParse({ deliverableId: "nope", note: "Please review this." }).success).toBe(
      false,
    );
    expect(withdrawReviewSchema.safeParse({ deliverableId: ID }).success).toBe(true);
  });

  it("lets a client approve with or without a comment", () => {
    expect(clientReviewSchema.safeParse({ deliverableId: ID, decision: "approve" }).success).toBe(true);
    expect(
      clientReviewSchema.parse({ deliverableId: ID, decision: "approve", comment: "  Great  " }).comment,
    ).toBe("Great");
  });

  it("requires a real comment when asking for changes", () => {
    const missing = clientReviewSchema.safeParse({ deliverableId: ID, decision: "request_changes" });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues[0].path).toEqual(["comment"]);
    expect(
      clientReviewSchema.safeParse({ deliverableId: ID, decision: "request_changes", comment: "too short" })
        .success,
    ).toBe(false);
    expect(
      clientReviewSchema.safeParse({
        deliverableId: ID,
        decision: "request_changes",
        comment: "Please make the logo larger on mobile.",
      }).success,
    ).toBe(true);
  });

  it("rejects forged decisions, ids and extra fields", () => {
    expect(clientReviewSchema.safeParse({ deliverableId: ID, decision: "delete" }).success).toBe(false);
    expect(clientReviewSchema.safeParse({ deliverableId: "x", decision: "approve" }).success).toBe(false);
    expect(
      clientReviewSchema.safeParse({
        deliverableId: ID,
        decision: "approve",
        organizationId: "someone-elses",
      }).success,
    ).toBe(false);
    const fd = new FormData();
    fd.set("deliverableId", ID);
    fd.set("decision", "approve");
    fd.set("organizationId", "someone-elses");
    fd.set("$ACTION_ID_x", "1");
    expect(Object.keys(pickFields(fd, CLIENT_REVIEW_FIELDS)).sort()).toEqual(["decision", "deliverableId"]);
    expect(Object.keys(pickFields(fd, SUBMIT_FIELDS))).toEqual(["deliverableId"]);
  });
});
