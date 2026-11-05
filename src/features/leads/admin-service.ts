import "server-only";
import mongoose from "mongoose";
import { recordAudit } from "@/features/audit/service";
import type { AuditActor } from "@/features/audit/types";
import { Organization } from "@/features/organizations/models/organization";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import { PAGE_SIZE, escapeRegex, type LeadFilters } from "./admin-schema";
import { Lead } from "./models/lead";
import { LeadActivity } from "./models/lead-activity";
import { LEAD_STATUSES, normalizeLeadStatus, validateTransition, type LeadStatus } from "./pipeline";
import type { BUDGET_RANGES, PROJECT_TYPES, TIMEFRAMES } from "./schema";

export interface LeadListRow {
  id: string;
  referenceCode: string;
  name: string;
  company: string | null;
  email: string;
  projectType: (typeof PROJECT_TYPES)[number];
  budgetRange: (typeof BUDGET_RANGES)[number] | null;
  status: LeadStatus;
  createdAt: Date;
}

export interface LeadList {
  rows: LeadListRow[];
  total: number;
  page: number;
  pageCount: number;
  counts: Record<LeadStatus, number>;
}

/** Filtered, searched and paginated list. Search text is escaped, so it can never act as a pattern. */
export async function listLeads(filters: LeadFilters): Promise<LeadList> {
  await connectToDatabase();
  const base = { archivedAt: { $exists: false } };
  const query: Record<string, unknown> = { ...base };
  if (filters.status) query.status = filters.status;
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [{ name: pattern }, { email: pattern }, { company: pattern }, { referenceCode: pattern }];
  }

  const [total, grouped] = await Promise.all([
    Lead.countDocuments(query),
    Lead.aggregate<{ _id: string; count: number }>([
      { $match: base },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = await Lead.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  const counts = Object.fromEntries(LEAD_STATUSES.map((status) => [status, 0])) as Record<LeadStatus, number>;
  for (const row of grouped) counts[normalizeLeadStatus(row._id)] += row.count;

  return {
    rows: rows.map((row) => ({
      id: String(row._id),
      referenceCode: row.referenceCode,
      name: row.name,
      company: row.company ?? null,
      email: row.email,
      projectType: row.projectType,
      budgetRange: row.budgetRange ?? null,
      status: normalizeLeadStatus(row.status),
      createdAt: (row as unknown as { createdAt: Date }).createdAt,
    })),
    total,
    page,
    pageCount,
    counts,
  };
}

export interface LeadDetail extends LeadListRow {
  message: string;
  timeframe: (typeof TIMEFRAMES)[number] | null;
  organizationId: string | null;
  organizationName: string | null;
}

/** Returns null for malformed and unknown ids alike, so the page can simply 404. */
export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const lead = await Lead.findById(id).lean();
  if (!lead) return null;
  const organization = lead.organizationId ? await Organization.findById(lead.organizationId).lean() : null;
  return {
    id: String(lead._id),
    referenceCode: lead.referenceCode,
    name: lead.name,
    company: lead.company ?? null,
    email: lead.email,
    projectType: lead.projectType,
    budgetRange: lead.budgetRange ?? null,
    timeframe: lead.timeframe ?? null,
    message: lead.message,
    status: normalizeLeadStatus(lead.status),
    organizationId: lead.organizationId ?? null,
    organizationName: organization?.name ?? null,
    createdAt: (lead as unknown as { createdAt: Date }).createdAt,
  };
}

export interface ActivityRow {
  id: string;
  type: "note" | "status_change" | "organization_linked";
  body: string | null;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus | null;
  actorEmail: string;
  createdAt: Date;
}

export async function listLeadActivity(leadId: string): Promise<ActivityRow[]> {
  if (!isObjectId(leadId)) return [];
  await connectToDatabase();
  const rows = await LeadActivity.find({ leadId }).sort({ createdAt: -1 }).limit(200).lean();
  return rows.map((row) => ({
    id: String(row._id),
    type: row.type,
    body: row.body ?? null,
    fromStatus: row.fromStatus ?? null,
    toStatus: row.toStatus ?? null,
    actorEmail: row.actorEmail,
    createdAt: (row as unknown as { createdAt: Date }).createdAt,
  }));
}

export type ChangeStatusResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "invalid-transition" | "needs-organization" | "changed-elsewhere" };

/**
 * Moves a lead along the pipeline. The check, the update, the history entry and the audit record all
 * commit together or not at all, and the update only applies if nobody else changed the status meanwhile.
 */
export async function changeLeadStatus(input: {
  id: string;
  to: LeadStatus;
  note?: string;
  actor: AuditActor;
}): Promise<ChangeStatusResult> {
  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    let result: ChangeStatusResult = { ok: false, reason: "not-found" };
    await session.withTransaction(async () => {
      const lead = await Lead.findById(input.id).session(session);
      if (!lead) {
        result = { ok: false, reason: "not-found" };
        return;
      }
      const from = normalizeLeadStatus(lead.status);
      const check = validateTransition({ from, to: input.to, hasOrganization: Boolean(lead.organizationId) });
      if (!check.ok) {
        result = { ok: false, reason: check.reason };
        return;
      }
      const updated = await Lead.updateOne(
        { _id: input.id, status: lead.status },
        { $set: { status: input.to } },
        { session },
      );
      if (updated.modifiedCount !== 1) {
        result = { ok: false, reason: "changed-elsewhere" };
        return;
      }
      await LeadActivity.create(
        [
          {
            leadId: input.id,
            type: "status_change",
            body: input.note,
            fromStatus: from,
            toStatus: input.to,
            actorId: input.actor.id,
            actorEmail: input.actor.email,
          },
        ],
        { session },
      );
      await recordAudit(
        {
          actor: input.actor,
          action: "lead.status_changed",
          target: { type: "lead", id: input.id },
          metadata: { from, to: input.to, referenceCode: lead.referenceCode },
        },
        session,
      );
      result = { ok: true };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function addLeadNote(input: { id: string; body: string; actor: AuditActor }): Promise<boolean> {
  await connectToDatabase();
  if (!(await Lead.exists({ _id: input.id }))) return false;
  await LeadActivity.create({
    leadId: input.id,
    type: "note",
    body: input.body,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
  });
  return true;
}

export type CreateOrganizationFromLeadResult =
  { ok: true; organizationId: string } | { ok: false; reason: "not-found" | "already-linked" };

/** Creates the client organization for a lead and links them, in one transaction with its history and audit. */
export async function createOrganizationFromLead(input: {
  id: string;
  actor: AuditActor;
}): Promise<CreateOrganizationFromLeadResult> {
  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    let result: CreateOrganizationFromLeadResult = { ok: false, reason: "not-found" };
    await session.withTransaction(async () => {
      const lead = await Lead.findById(input.id).session(session);
      if (!lead) {
        result = { ok: false, reason: "not-found" };
        return;
      }
      if (lead.organizationId) {
        result = { ok: false, reason: "already-linked" };
        return;
      }
      const name = (lead.company?.trim() || lead.name).slice(0, 120);
      const [organization] = await Organization.create(
        [
          {
            name,
            contactEmail: lead.email,
            status: "active",
            createdBy: input.actor.id,
            createdByEmail: input.actor.email,
          },
        ],
        { session },
      );
      const organizationId = String(organization._id);
      const linked = await Lead.updateOne(
        { _id: input.id, organizationId: { $exists: false } },
        { $set: { organizationId } },
        { session },
      );
      if (linked.modifiedCount !== 1) throw new Error("lead was linked by someone else");
      await LeadActivity.create(
        [
          {
            leadId: input.id,
            type: "organization_linked",
            body: `Created client organization "${name}".`,
            actorId: input.actor.id,
            actorEmail: input.actor.email,
          },
        ],
        { session },
      );
      await recordAudit(
        {
          actor: input.actor,
          action: "organization.created",
          target: { type: "organization", id: organizationId },
          metadata: { name, fromLead: input.id },
        },
        session,
      );
      result = { ok: true, organizationId };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
