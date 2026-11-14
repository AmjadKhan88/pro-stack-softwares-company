import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { recordAudit } from "@/features/audit/service";
import { connectToDatabase } from "@/server/db/mongoose";
import { isObjectId } from "@/lib/object-id";
import { Deliverable } from "./models/deliverable";
import { Project } from "./models/project";
import { ReviewEvent } from "./models/review-event";
import {
  canMoveReview,
  canSubmitForReview,
  normalizeReviewState,
  reviewStateFilter,
  type ReviewEventType,
} from "./review";
import { clientProjectFilter, clientVisibleChildFilter, isProjectOpen } from "./status";

async function withSession<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let value!: T;
    await session.withTransaction(async () => {
      value = await work(session);
    });
    return value;
  } finally {
    await session.endSession();
  }
}

export type ReviewResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not-found" | "project-closed" | "not-visible" | "invalid-transition" | "changed-elsewhere";
    };

interface Person {
  id: string;
  email: string;
  name: string;
}

// ---------------------------------------------------------------- staff

/** Sends a deliverable to the client for review. Everything commits together or not at all. */
export async function submitForReview(input: {
  actor: Person;
  deliverableId: string;
  note: string;
}): Promise<ReviewResult> {
  await connectToDatabase();
  return withSession<ReviewResult>(async (session) => {
    const deliverable = await Deliverable.findById(input.deliverableId).session(session);
    if (!deliverable) return { ok: false, reason: "not-found" };
    const project = await Project.findById(deliverable.projectId).session(session);
    if (!project) return { ok: false, reason: "not-found" };

    const state = normalizeReviewState(deliverable.reviewStatus);
    const check = canSubmitForReview({
      reviewState: state,
      clientVisible: deliverable.clientVisible,
      projectOpen: isProjectOpen(project.status),
    });
    if (!check.ok) return { ok: false, reason: check.reason };

    const round = (deliverable.reviewRound ?? 0) + 1;
    const changed = await Deliverable.updateOne(
      { _id: input.deliverableId, reviewStatus: reviewStateFilter(state) },
      { $set: { reviewStatus: "in_review", reviewRound: round } },
      { session },
    );
    if (changed.modifiedCount !== 1) return { ok: false, reason: "changed-elsewhere" };

    await ReviewEvent.create(
      [
        {
          deliverableId: input.deliverableId,
          projectId: deliverable.projectId,
          round,
          type: "submitted" as const,
          message: input.note,
          actorId: input.actor.id,
          actorName: input.actor.name,
          actorType: "staff" as const,
        },
      ],
      { session },
    );
    await recordAudit(
      {
        actor: { id: input.actor.id, email: input.actor.email },
        action: "deliverable.review_submitted",
        target: { type: "deliverable", id: input.deliverableId },
        metadata: { projectId: deliverable.projectId, title: deliverable.title, round },
      },
      session,
    );
    return { ok: true };
  });
}

/** Takes a submission back (for example it was sent by mistake) while the client has not answered. */
export async function withdrawReview(input: { actor: Person; deliverableId: string }): Promise<ReviewResult> {
  await connectToDatabase();
  return withSession<ReviewResult>(async (session) => {
    const deliverable = await Deliverable.findById(input.deliverableId).session(session);
    if (!deliverable) return { ok: false, reason: "not-found" };
    const project = await Project.findById(deliverable.projectId).session(session);
    if (!project) return { ok: false, reason: "not-found" };
    if (!isProjectOpen(project.status)) return { ok: false, reason: "project-closed" };

    const state = normalizeReviewState(deliverable.reviewStatus);
    if (!canMoveReview(state, "not_submitted", "staff")) return { ok: false, reason: "invalid-transition" };

    const changed = await Deliverable.updateOne(
      { _id: input.deliverableId, reviewStatus: "in_review" },
      { $set: { reviewStatus: "not_submitted" } },
      { session },
    );
    if (changed.modifiedCount !== 1) return { ok: false, reason: "changed-elsewhere" };

    await ReviewEvent.create(
      [
        {
          deliverableId: input.deliverableId,
          projectId: deliverable.projectId,
          round: deliverable.reviewRound ?? 0,
          type: "withdrawn" as const,
          actorId: input.actor.id,
          actorName: input.actor.name,
          actorType: "staff" as const,
        },
      ],
      { session },
    );
    await recordAudit(
      {
        actor: { id: input.actor.id, email: input.actor.email },
        action: "deliverable.review_withdrawn",
        target: { type: "deliverable", id: input.deliverableId },
        metadata: { projectId: deliverable.projectId, title: deliverable.title },
      },
      session,
    );
    return { ok: true };
  });
}

// ---------------------------------------------------------------- client

/**
 * A client approves a deliverable or asks for changes. The deliverable must be one staff made visible AND must
 * belong to a project of the client's own organization: another organization's deliverable looks like a missing one.
 */
export async function clientRespondToReview(input: {
  organizationId: string;
  user: Person;
  deliverableId: string;
  decision: "approve" | "request_changes";
  comment?: string;
}): Promise<ReviewResult> {
  await connectToDatabase();
  return withSession<ReviewResult>(async (session) => {
    const deliverable = await Deliverable.findOne({ _id: input.deliverableId, clientVisible: true }).session(
      session,
    );
    if (!deliverable) return { ok: false, reason: "not-found" };
    const project = await Project.findOne(
      clientProjectFilter(input.organizationId, deliverable.projectId),
    ).session(session);
    if (!project) return { ok: false, reason: "not-found" };
    if (!isProjectOpen(project.status)) return { ok: false, reason: "project-closed" };

    const to = input.decision === "approve" ? ("approved" as const) : ("changes_requested" as const);
    const state = normalizeReviewState(deliverable.reviewStatus);
    if (!canMoveReview(state, to, "client")) return { ok: false, reason: "invalid-transition" };

    // Approving also marks the work as delivered, so the two can never disagree.
    const set = to === "approved" ? { reviewStatus: to, status: "delivered" as const } : { reviewStatus: to };
    const changed = await Deliverable.updateOne(
      { _id: input.deliverableId, reviewStatus: "in_review" },
      { $set: set },
      { session },
    );
    if (changed.modifiedCount !== 1) return { ok: false, reason: "changed-elsewhere" };

    const type: ReviewEventType = to === "approved" ? "approved" : "changes_requested";
    await ReviewEvent.create(
      [
        {
          deliverableId: input.deliverableId,
          projectId: deliverable.projectId,
          round: deliverable.reviewRound ?? 0,
          type,
          message: input.comment,
          actorId: input.user.id,
          actorName: input.user.name,
          actorType: "client" as const,
        },
      ],
      { session },
    );
    await recordAudit(
      {
        actor: { id: input.user.id, email: input.user.email },
        action: to === "approved" ? "deliverable.review_approved" : "deliverable.review_changes_requested",
        target: { type: "deliverable", id: input.deliverableId },
        metadata: {
          projectId: deliverable.projectId,
          title: deliverable.title,
          round: deliverable.reviewRound ?? 0,
        },
      },
      session,
    );
    return { ok: true };
  });
}

// ---------------------------------------------------------------- reads

export interface ReviewEventView {
  id: string;
  deliverableId: string;
  round: number;
  type: ReviewEventType;
  message: string | null;
  actorName: string;
  actorType: "staff" | "client";
  createdAt: Date;
}

type LeanEvent = {
  _id: unknown;
  deliverableId: string;
  round: number;
  type: ReviewEventType;
  message?: string;
  actorName: string;
  actorType: "staff" | "client";
};

function group(docs: LeanEvent[]): Record<string, ReviewEventView[]> {
  const grouped: Record<string, ReviewEventView[]> = {};
  for (const doc of docs) {
    (grouped[doc.deliverableId] ??= []).push({
      id: String(doc._id),
      deliverableId: doc.deliverableId,
      round: doc.round,
      type: doc.type,
      message: doc.message ?? null,
      actorName: doc.actorName,
      actorType: doc.actorType,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt,
    });
  }
  return grouped;
}

/** Staff see the history of every deliverable in a project. */
export async function listProjectReviewEvents(projectId: string): Promise<Record<string, ReviewEventView[]>> {
  if (!isObjectId(projectId)) return {};
  await connectToDatabase();
  const docs = await ReviewEvent.find({ projectId }).sort({ createdAt: 1 }).lean();
  return group(docs);
}

/**
 * A client sees the history only of deliverables staff made visible, and only for a project of their own
 * organization (re-checked here, so this function is safe even if a caller forgets).
 */
export async function listClientProjectReviewEvents(
  organizationId: string,
  projectId: string,
): Promise<Record<string, ReviewEventView[]>> {
  if (!isObjectId(projectId)) return {};
  await connectToDatabase();
  if (!(await Project.exists(clientProjectFilter(organizationId, projectId)))) return {};
  const visible = await Deliverable.find(clientVisibleChildFilter(projectId)).select("_id").lean();
  const ids = visible.map((d) => String(d._id));
  if (ids.length === 0) return {};
  const docs = await ReviewEvent.find({ projectId, deliverableId: { $in: ids } })
    .sort({ createdAt: 1 })
    .lean();
  return group(docs);
}
