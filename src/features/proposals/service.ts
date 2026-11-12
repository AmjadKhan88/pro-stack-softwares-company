import "server-only";
import mongoose from "mongoose";
import { recordAudit } from "@/features/audit/service";
import type { AuditAction, AuditActor } from "@/features/audit/types";
import { Lead } from "@/features/leads/models/lead";
import { LeadActivity } from "@/features/leads/models/lead-activity";
import { normalizeLeadStatus } from "@/features/leads/pipeline";
import { Organization } from "@/features/organizations/models/organization";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import { generateProposalCode } from "./code";
import type { Currency } from "./money";
import { Proposal, type ProposalDoc, type Responder } from "./models/proposal";
import type { ProposalInput } from "./schema";
import { PROPOSAL_STATUSES, canMove, clientProposalFilter, expiryFrom, type ProposalStatus } from "./status";

export interface ProposalView {
  id: string;
  code: string;
  leadId: string;
  organizationId: string;
  organizationName: string | null;
  title: string;
  summary: string;
  scope: string;
  deliverables: string[];
  assumptions: string[];
  exclusions: string[];
  timelineSummary: string;
  estimatedWeeks: number;
  currency: Currency;
  totalMinor: number;
  paymentTerms: string;
  status: ProposalStatus;
  sentAt: Date | null;
  expiresAt: Date | null;
  acceptedAt: Date | null;
  acceptedBy: Responder | null;
  declinedAt: Date | null;
  declinedBy: Responder | null;
  declineReason: string | null;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

type LeanProposal = ProposalDoc & { _id: unknown };

function toView(doc: LeanProposal, organizationName: string | null): ProposalView {
  const stamps = doc as unknown as { createdAt: Date; updatedAt: Date };
  return {
    id: String(doc._id),
    code: doc.code,
    leadId: doc.leadId,
    organizationId: doc.organizationId,
    organizationName,
    title: doc.title,
    summary: doc.summary,
    scope: doc.scope,
    deliverables: doc.deliverables,
    assumptions: doc.assumptions,
    exclusions: doc.exclusions,
    timelineSummary: doc.timelineSummary,
    estimatedWeeks: doc.estimatedWeeks,
    currency: doc.currency,
    totalMinor: doc.totalMinor,
    paymentTerms: doc.paymentTerms,
    status: doc.status,
    sentAt: doc.sentAt ?? null,
    expiresAt: doc.expiresAt ?? null,
    acceptedAt: doc.acceptedAt ?? null,
    acceptedBy: doc.acceptedBy ?? null,
    declinedAt: doc.declinedAt ?? null,
    declinedBy: doc.declinedBy ?? null,
    declineReason: doc.declineReason ?? null,
    createdByEmail: doc.createdByEmail,
    createdAt: stamps.createdAt,
    updatedAt: stamps.updatedAt,
  };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function contentFields(input: ProposalInput) {
  return {
    title: input.title,
    summary: input.summary,
    scope: input.scope,
    deliverables: input.deliverables,
    assumptions: input.assumptions,
    exclusions: input.exclusions,
    timelineSummary: input.timelineSummary,
    estimatedWeeks: input.estimatedWeeks,
    currency: input.currency,
    totalMinor: input.totalAmount,
    paymentTerms: input.paymentTerms,
  };
}

// ---------------------------------------------------------------- staff writes

export type CreateProposalResult =
  | { ok: true; id: string }
  | {
      ok: false;
      reason: "lead-not-found" | "lead-not-qualified" | "lead-needs-organization" | "open-proposal-exists";
    };

/** A proposal can only be written for a qualified lead that already has its client organization. */
export async function createProposalFromLead(input: {
  leadId: string;
  content: ProposalInput;
  actor: AuditActor;
}): Promise<CreateProposalResult> {
  await connectToDatabase();
  for (let attempt = 0; attempt < 3; attempt++) {
    const session = await mongoose.startSession();
    try {
      let result: CreateProposalResult = { ok: false, reason: "lead-not-found" };
      await session.withTransaction(async () => {
        const lead = await Lead.findById(input.leadId).session(session);
        if (!lead) {
          result = { ok: false, reason: "lead-not-found" };
          return;
        }
        if (normalizeLeadStatus(lead.status) !== "qualified") {
          result = { ok: false, reason: "lead-not-qualified" };
          return;
        }
        if (!lead.organizationId) {
          result = { ok: false, reason: "lead-needs-organization" };
          return;
        }
        const open = await Proposal.exists({
          leadId: input.leadId,
          status: { $in: ["draft", "sent"] },
        }).session(session);
        if (open) {
          result = { ok: false, reason: "open-proposal-exists" };
          return;
        }

        const code = generateProposalCode();
        const [created] = await Proposal.create(
          [
            {
              code,
              leadId: input.leadId,
              organizationId: lead.organizationId,
              ...contentFields(input.content),
              status: "draft",
              createdBy: input.actor.id,
              createdByEmail: input.actor.email,
            },
          ],
          { session },
        );
        const id = String(created._id);
        await LeadActivity.create(
          [
            {
              leadId: input.leadId,
              type: "proposal",
              body: `Proposal ${code} created as a draft.`,
              actorId: input.actor.id,
              actorEmail: input.actor.email,
            },
          ],
          { session },
        );
        await recordAudit(
          {
            actor: input.actor,
            action: "proposal.created",
            target: { type: "proposal", id },
            metadata: { code, leadId: input.leadId, organizationId: lead.organizationId },
          },
          session,
        );
        result = { ok: true, id };
      });
      return result;
    } catch (error) {
      if (isDuplicateKey(error) && attempt < 2) continue; // proposal code collision: try another code
      throw error;
    } finally {
      await session.endSession();
    }
  }
  throw new Error("Could not allocate a unique proposal code");
}

export type UpdateDraftResult = { ok: true } | { ok: false; reason: "not-found" | "not-editable" };

/** Only a draft can be edited, and the check is part of the update itself so it cannot be raced. */
export async function updateDraftProposal(input: {
  id: string;
  content: ProposalInput;
}): Promise<UpdateDraftResult> {
  await connectToDatabase();
  const updated = await Proposal.findOneAndUpdate(
    { _id: input.id, status: "draft" },
    { $set: contentFields(input.content) },
    { returnDocument: "after" },
  ).lean();
  if (updated) return { ok: true };
  return (await Proposal.exists({ _id: input.id }))
    ? { ok: false, reason: "not-editable" }
    : { ok: false, reason: "not-found" };
}

export type StaffTransitionResult =
  | { ok: true; code: string; title: string; organizationId: string; expiresAt: Date | null }
  | { ok: false; reason: "not-found" | "invalid-transition" | "changed-elsewhere" };

const STAFF_AUDIT: Partial<Record<ProposalStatus, AuditAction>> = {
  sent: "proposal.sent",
  withdrawn: "proposal.withdrawn",
  draft: "proposal.reopened",
};

const STAFF_ACTIVITY: Partial<Record<ProposalStatus, string>> = {
  sent: "sent to the client",
  withdrawn: "withdrawn",
  draft: "reopened as a draft",
};

/** Send, withdraw or reopen. The move, the lead history entry and the audit record commit together. */
export async function transitionProposalByStaff(input: {
  id: string;
  to: ProposalStatus;
  actor: AuditActor;
}): Promise<StaffTransitionResult> {
  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    let result: StaffTransitionResult = { ok: false, reason: "not-found" };
    await session.withTransaction(async () => {
      const proposal = await Proposal.findById(input.id).session(session);
      if (!proposal) {
        result = { ok: false, reason: "not-found" };
        return;
      }
      if (!canMove(proposal.status, input.to, "staff")) {
        result = { ok: false, reason: "invalid-transition" };
        return;
      }

      const now = new Date();
      const expiresAt = input.to === "sent" ? expiryFrom(now) : null;
      const update =
        input.to === "sent"
          ? { $set: { status: "sent" as const, sentAt: now, expiresAt } }
          : input.to === "draft"
            ? {
                $set: { status: "draft" as const },
                $unset: { sentAt: 1, expiresAt: 1, declinedAt: 1, declinedBy: 1, declineReason: 1 },
              }
            : { $set: { status: input.to } };

      const changed = await Proposal.updateOne({ _id: input.id, status: proposal.status }, update, {
        session,
      });
      if (changed.modifiedCount !== 1) {
        result = { ok: false, reason: "changed-elsewhere" };
        return;
      }
      await LeadActivity.create(
        [
          {
            leadId: proposal.leadId,
            type: "proposal",
            body: `Proposal ${proposal.code} ${STAFF_ACTIVITY[input.to] ?? input.to}.`,
            actorId: input.actor.id,
            actorEmail: input.actor.email,
          },
        ],
        { session },
      );
      await recordAudit(
        {
          actor: input.actor,
          action: STAFF_AUDIT[input.to] ?? "proposal.sent",
          target: { type: "proposal", id: input.id },
          metadata: { code: proposal.code, from: proposal.status, to: input.to },
        },
        session,
      );
      result = {
        ok: true,
        code: proposal.code,
        title: proposal.title,
        organizationId: proposal.organizationId,
        expiresAt,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// ---------------------------------------------------------------- staff reads

export interface ProposalList {
  rows: ProposalView[];
  counts: Record<ProposalStatus, number>;
}

async function organizationNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(isObjectId);
  if (unique.length === 0) return new Map();
  const organizations = await Organization.find({ _id: { $in: unique } }).lean();
  return new Map(organizations.map((o) => [String(o._id), o.name]));
}

export async function listProposals(filter: { status?: ProposalStatus } = {}): Promise<ProposalList> {
  await connectToDatabase();
  const [docs, grouped] = await Promise.all([
    Proposal.find(filter.status ? { status: filter.status } : {})
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean(),
    Proposal.aggregate<{ _id: ProposalStatus; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  const names = await organizationNames(docs.map((d) => d.organizationId));
  const counts = Object.fromEntries(PROPOSAL_STATUSES.map((s) => [s, 0])) as Record<ProposalStatus, number>;
  for (const row of grouped) if (row._id in counts) counts[row._id] += row.count;
  return { rows: docs.map((d) => toView(d, names.get(d.organizationId) ?? null)), counts };
}

export async function getProposalForStaff(id: string): Promise<ProposalView | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Proposal.findById(id).lean();
  if (!doc) return null;
  const names = await organizationNames([doc.organizationId]);
  return toView(doc, names.get(doc.organizationId) ?? null);
}

export async function listProposalsForLead(leadId: string): Promise<ProposalView[]> {
  if (!isObjectId(leadId)) return [];
  await connectToDatabase();
  const docs = await Proposal.find({ leadId }).sort({ createdAt: -1 }).lean();
  return docs.map((d) => toView(d, null));
}

// ---------------------------------------------------------------- client reads (always tenant-scoped)

export async function listClientProposals(organizationId: string): Promise<ProposalView[]> {
  await connectToDatabase();
  const docs = await Proposal.find(clientProposalFilter(organizationId)).sort({ updatedAt: -1 }).lean();
  return docs.map((d) => toView(d, null));
}

/** Returns null for a malformed id, another organization's proposal, a draft or a withdrawn one: all look alike. */
export async function getClientProposal(organizationId: string, id: string): Promise<ProposalView | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Proposal.findOne(clientProposalFilter(organizationId, id)).lean();
  return doc ? toView(doc, null) : null;
}

// ---------------------------------------------------------------- client response

export type RespondResult = { ok: true; code: string } | { ok: false; reason: "unavailable" };

/**
 * A client answers their own organization's proposal. The filter below does four checks at once and the update is
 * atomic: right organization, right proposal, still "sent", not expired. Anything else is simply "unavailable".
 */
export async function respondToProposal(input: {
  organizationId: string;
  proposalId: string;
  decision: "accept" | "decline";
  reason?: string;
  user: { id: string; email: string; name: string };
}): Promise<RespondResult> {
  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    let result: RespondResult = { ok: false, reason: "unavailable" };
    await session.withTransaction(async () => {
      const now = new Date();
      const responder: Responder = { userId: input.user.id, email: input.user.email, name: input.user.name };
      const update =
        input.decision === "accept"
          ? { $set: { status: "accepted" as const, acceptedAt: now, acceptedBy: responder } }
          : {
              $set: {
                status: "declined" as const,
                declinedAt: now,
                declinedBy: responder,
                ...(input.reason ? { declineReason: input.reason } : {}),
              },
            };
      const proposal = await Proposal.findOneAndUpdate(
        {
          _id: input.proposalId,
          organizationId: input.organizationId,
          status: "sent",
          expiresAt: { $gt: now },
        },
        update,
        { session, returnDocument: "after" },
      );
      if (!proposal) {
        result = { ok: false, reason: "unavailable" };
        return;
      }
      const accepted = input.decision === "accept";
      await LeadActivity.create(
        [
          {
            leadId: proposal.leadId,
            type: "proposal",
            body: `Proposal ${proposal.code} ${accepted ? "accepted" : "declined"} by ${input.user.email}.${
              !accepted && input.reason ? ` Reason: ${input.reason}` : ""
            }`,
            actorId: input.user.id,
            actorEmail: input.user.email,
          },
        ],
        { session },
      );
      await recordAudit(
        {
          actor: { id: input.user.id, email: input.user.email },
          action: accepted ? "proposal.accepted" : "proposal.declined",
          target: { type: "proposal", id: input.proposalId },
          metadata: { code: proposal.code, organizationId: input.organizationId },
        },
        session,
      );
      result = { ok: true, code: proposal.code };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
