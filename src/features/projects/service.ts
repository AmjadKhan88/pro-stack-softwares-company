import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { recordAudit } from "@/features/audit/service";
import type { AuditActor } from "@/features/audit/types";
import { Lead } from "@/features/leads/models/lead";
import { LeadActivity } from "@/features/leads/models/lead-activity";
import { normalizeLeadStatus, validateTransition } from "@/features/leads/pipeline";
import { Organization } from "@/features/organizations/models/organization";
import { Proposal } from "@/features/proposals/models/proposal";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import { generateProjectCode } from "./code";
import { Deliverable, type DeliverableDoc } from "./models/deliverable";
import { Milestone, type MilestoneDoc } from "./models/milestone";
import { Project, type ProjectDoc } from "./models/project";
import {
  canMoveItem,
  canMoveProject,
  clientProjectFilter,
  clientVisibleChildFilter,
  isProjectOpen,
  milestoneProgress,
  type DeliverableStatus,
  type MilestoneStatus,
  type ProjectStatus,
} from "./status";
import { normalizeReviewState, type ReviewState } from "./review";

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

/** Runs the work in one transaction: everything inside commits together or not at all. */
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

// ---------------------------------------------------------------- views

export interface ProjectView {
  id: string;
  code: string;
  organizationId: string;
  organizationName: string | null;
  leadId: string;
  proposalId: string;
  title: string;
  summary: string;
  status: ProjectStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MilestoneView {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  status: MilestoneStatus;
  clientVisible: boolean;
}

export interface DeliverableView {
  id: string;
  milestoneId: string | null;
  title: string;
  description: string | null;
  status: DeliverableStatus;
  clientVisible: boolean;
  reviewStatus: ReviewState;
  reviewRound: number;
}

function toProjectView(doc: ProjectDoc & { _id: unknown }, organizationName: string | null): ProjectView {
  const stamps = doc as unknown as { createdAt: Date; updatedAt: Date };
  return {
    id: String(doc._id),
    code: doc.code,
    organizationId: doc.organizationId,
    organizationName,
    leadId: doc.leadId,
    proposalId: doc.proposalId,
    title: doc.title,
    summary: doc.summary,
    status: doc.status,
    startedAt: doc.startedAt ?? null,
    completedAt: doc.completedAt ?? null,
    createdByEmail: doc.createdByEmail,
    createdAt: stamps.createdAt,
    updatedAt: stamps.updatedAt,
  };
}

function toMilestoneView(doc: MilestoneDoc & { _id: unknown }): MilestoneView {
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description ?? null,
    dueDate: doc.dueDate ?? null,
    status: doc.status,
    clientVisible: doc.clientVisible,
  };
}

function toDeliverableView(doc: DeliverableDoc & { _id: unknown }): DeliverableView {
  return {
    id: String(doc._id),
    milestoneId: doc.milestoneId ?? null,
    title: doc.title,
    description: doc.description ?? null,
    status: doc.status,
    clientVisible: doc.clientVisible,
    reviewStatus: normalizeReviewState(doc.reviewStatus),
    reviewRound: doc.reviewRound ?? 0,
  };
}

// ---------------------------------------------------------------- conversion

export type ConvertResult =
  | { ok: true; projectId: string; code: string }
  | {
      ok: false;
      reason: "not-found" | "not-accepted" | "already-converted" | "lead-not-ready" | "changed-elsewhere";
    };

class ConversionConflict extends Error {}

/**
 * Turns an ACCEPTED proposal into a project, once. In one transaction it creates the project for the client's
 * organization, seeds its deliverables from the proposal, links the proposal to it, marks the lead as won,
 * writes the lead history and records the audit entries. If any step fails, none of it happens.
 */
export async function convertProposalToProject(input: {
  proposalId: string;
  actor: AuditActor;
}): Promise<ConvertResult> {
  await connectToDatabase();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await withSession<ConvertResult>(async (session) => {
        const proposal = await Proposal.findById(input.proposalId).session(session);
        if (!proposal) return { ok: false, reason: "not-found" };
        if (proposal.status !== "accepted") return { ok: false, reason: "not-accepted" };
        if (proposal.projectId) return { ok: false, reason: "already-converted" };

        const lead = await Lead.findById(proposal.leadId).session(session);
        if (!lead) return { ok: false, reason: "lead-not-ready" };
        const from = normalizeLeadStatus(lead.status);
        const check = validateTransition({ from, to: "won", hasOrganization: Boolean(lead.organizationId) });
        if (!check.ok) return { ok: false, reason: "lead-not-ready" };

        const code = generateProjectCode();
        const [project] = await Project.create(
          [
            {
              code,
              organizationId: proposal.organizationId,
              leadId: proposal.leadId,
              proposalId: input.proposalId,
              title: proposal.title,
              summary: proposal.summary,
              status: "planning",
              createdBy: input.actor.id,
              createdByEmail: input.actor.email,
            },
          ],
          { session },
        );
        const projectId = String(project._id);

        // The client already agreed to these deliverables in the proposal, so they start visible to them.
        if (proposal.deliverables.length > 0) {
          await Deliverable.create(
            proposal.deliverables.map((title, position) => ({
              projectId,
              title,
              status: "planned" as const,
              position,
              clientVisible: true,
              createdBy: input.actor.id,
            })),
            { session },
          );
        }

        const linked = await Proposal.updateOne(
          { _id: input.proposalId, status: "accepted", projectId: { $exists: false } },
          { $set: { projectId } },
          { session },
        );
        if (linked.modifiedCount !== 1) throw new ConversionConflict();

        const won = await Lead.updateOne(
          { _id: proposal.leadId, status: lead.status },
          { $set: { status: "won" } },
          { session },
        );
        if (won.modifiedCount !== 1) throw new ConversionConflict();

        await LeadActivity.create(
          [
            {
              leadId: proposal.leadId,
              type: "status_change",
              fromStatus: from,
              toStatus: "won",
              body: `Proposal ${proposal.code} converted to project ${code}.`,
              actorId: input.actor.id,
              actorEmail: input.actor.email,
            },
          ],
          { session },
        );
        await recordAudit(
          {
            actor: input.actor,
            action: "project.created",
            target: { type: "project", id: projectId },
            metadata: { code, proposalId: input.proposalId, leadId: proposal.leadId },
          },
          session,
        );
        await recordAudit(
          {
            actor: input.actor,
            action: "lead.status_changed",
            target: { type: "lead", id: proposal.leadId },
            metadata: { from, to: "won", via: "proposal conversion", referenceCode: lead.referenceCode },
          },
          session,
        );
        return { ok: true, projectId, code };
      });
    } catch (error) {
      if (error instanceof ConversionConflict) return { ok: false, reason: "changed-elsewhere" };
      if (isDuplicateKey(error) && attempt < 2) continue; // code collision, or a racing conversion: re-check
      throw error;
    }
  }
  throw new Error("Could not convert the proposal");
}

// ---------------------------------------------------------------- staff writes

export type ItemResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "project-closed" | "invalid-transition" | "changed-elsewhere" };

export async function changeProjectStatus(input: {
  actor: AuditActor;
  id: string;
  to: ProjectStatus;
}): Promise<ItemResult> {
  await connectToDatabase();
  return withSession<ItemResult>(async (session) => {
    const project = await Project.findById(input.id).session(session);
    if (!project) return { ok: false, reason: "not-found" };
    if (!canMoveProject(project.status, input.to)) return { ok: false, reason: "invalid-transition" };

    const set: Partial<ProjectDoc> = { status: input.to };
    if (input.to === "active" && !project.startedAt) set.startedAt = new Date();
    if (input.to === "completed") set.completedAt = new Date();
    const changed = await Project.updateOne(
      { _id: input.id, status: project.status },
      { $set: set },
      { session },
    );
    if (changed.modifiedCount !== 1) return { ok: false, reason: "changed-elsewhere" };

    await recordAudit(
      {
        actor: input.actor,
        action: "project.status_changed",
        target: { type: "project", id: input.id },
        metadata: { code: project.code, from: project.status, to: input.to },
      },
      session,
    );
    return { ok: true };
  });
}

export async function addMilestone(input: {
  actor: AuditActor;
  projectId: string;
  title: string;
  description?: string;
  dueDate?: Date;
  clientVisible: boolean;
}): Promise<ItemResult> {
  await connectToDatabase();
  return withSession<ItemResult>(async (session) => {
    const project = await Project.findById(input.projectId).session(session);
    if (!project) return { ok: false, reason: "not-found" };
    if (!isProjectOpen(project.status)) return { ok: false, reason: "project-closed" };

    const position = await Milestone.countDocuments({ projectId: input.projectId }).session(session);
    const [created] = await Milestone.create(
      [
        {
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          dueDate: input.dueDate,
          status: "planned",
          position,
          clientVisible: input.clientVisible,
          createdBy: input.actor.id,
        },
      ],
      { session },
    );
    await recordAudit(
      {
        actor: input.actor,
        action: "milestone.created",
        target: { type: "milestone", id: String(created._id) },
        metadata: { projectId: input.projectId, title: input.title, clientVisible: input.clientVisible },
      },
      session,
    );
    return { ok: true };
  });
}

export async function addDeliverable(input: {
  actor: AuditActor;
  projectId: string;
  milestoneId?: string;
  title: string;
  description?: string;
  clientVisible: boolean;
}): Promise<ItemResult> {
  await connectToDatabase();
  return withSession<ItemResult>(async (session) => {
    const project = await Project.findById(input.projectId).session(session);
    if (!project) return { ok: false, reason: "not-found" };
    if (!isProjectOpen(project.status)) return { ok: false, reason: "project-closed" };
    if (input.milestoneId) {
      // A deliverable can only hang off a milestone of the SAME project.
      const milestone = await Milestone.exists({
        _id: input.milestoneId,
        projectId: input.projectId,
      }).session(session);
      if (!milestone) return { ok: false, reason: "not-found" };
    }

    const position = await Deliverable.countDocuments({ projectId: input.projectId }).session(session);
    const [created] = await Deliverable.create(
      [
        {
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          title: input.title,
          description: input.description,
          status: "planned",
          position,
          clientVisible: input.clientVisible,
          createdBy: input.actor.id,
        },
      ],
      { session },
    );
    await recordAudit(
      {
        actor: input.actor,
        action: "deliverable.created",
        target: { type: "deliverable", id: String(created._id) },
        metadata: { projectId: input.projectId, title: input.title, clientVisible: input.clientVisible },
      },
      session,
    );
    return { ok: true };
  });
}

export async function changeMilestoneStatus(input: {
  actor: AuditActor;
  id: string;
  to: string;
}): Promise<ItemResult> {
  await connectToDatabase();
  return withSession<ItemResult>(async (session) => {
    const milestone = await Milestone.findById(input.id).session(session);
    if (!milestone) return { ok: false, reason: "not-found" };
    const project = await Project.findById(milestone.projectId).session(session);
    if (!project) return { ok: false, reason: "not-found" };
    if (!isProjectOpen(project.status)) return { ok: false, reason: "project-closed" };
    if (!canMoveItem("milestone", milestone.status, input.to))
      return { ok: false, reason: "invalid-transition" };

    const changed = await Milestone.updateOne(
      { _id: input.id, status: milestone.status },
      { $set: { status: input.to as MilestoneStatus } },
      { session },
    );
    if (changed.modifiedCount !== 1) return { ok: false, reason: "changed-elsewhere" };
    await recordAudit(
      {
        actor: input.actor,
        action: "milestone.status_changed",
        target: { type: "milestone", id: input.id },
        metadata: {
          projectId: milestone.projectId,
          title: milestone.title,
          from: milestone.status,
          to: input.to,
        },
      },
      session,
    );
    return { ok: true };
  });
}

export async function changeDeliverableStatus(input: {
  actor: AuditActor;
  id: string;
  to: string;
}): Promise<ItemResult> {
  await connectToDatabase();
  return withSession<ItemResult>(async (session) => {
    const deliverable = await Deliverable.findById(input.id).session(session);
    if (!deliverable) return { ok: false, reason: "not-found" };
    const project = await Project.findById(deliverable.projectId).session(session);
    if (!project) return { ok: false, reason: "not-found" };
    if (!isProjectOpen(project.status)) return { ok: false, reason: "project-closed" };
    if (normalizeReviewState(deliverable.reviewStatus) === "approved") {
      return { ok: false, reason: "invalid-transition" };
    }
    if (!canMoveItem("deliverable", deliverable.status, input.to))
      return { ok: false, reason: "invalid-transition" };

    const changed = await Deliverable.updateOne(
      { _id: input.id, status: deliverable.status },
      { $set: { status: input.to as DeliverableStatus } },
      { session },
    );
    if (changed.modifiedCount !== 1) return { ok: false, reason: "changed-elsewhere" };
    await recordAudit(
      {
        actor: input.actor,
        action: "deliverable.status_changed",
        target: { type: "deliverable", id: input.id },
        metadata: {
          projectId: deliverable.projectId,
          title: deliverable.title,
          from: deliverable.status,
          to: input.to,
        },
      },
      session,
    );
    return { ok: true };
  });
}

/** Showing or hiding something from the client changes who can read it, so it is always audited. */
export async function setItemVisibility(input: {
  actor: AuditActor;
  kind: "milestone" | "deliverable";
  id: string;
  visible: boolean;
}): Promise<ItemResult> {
  await connectToDatabase();
  return withSession<ItemResult>(async (session) => {
    let projectId: string;
    let title: string;
    if (input.kind === "milestone") {
      const milestone = await Milestone.findById(input.id).session(session);
      if (!milestone) return { ok: false, reason: "not-found" };
      projectId = milestone.projectId;
      title = milestone.title;
    } else {
      const deliverable = await Deliverable.findById(input.id).session(session);
      if (!deliverable) return { ok: false, reason: "not-found" };
      projectId = deliverable.projectId;
      title = deliverable.title;
      const reviewState = normalizeReviewState(deliverable.reviewStatus);
      if (!input.visible && (reviewState === "in_review" || reviewState === "approved")) {
        return { ok: false, reason: "invalid-transition" };
      }
    }
    const project = await Project.findById(projectId).session(session);
    if (!project) return { ok: false, reason: "not-found" };
    if (!isProjectOpen(project.status)) return { ok: false, reason: "project-closed" };

    if (input.kind === "milestone") {
      await Milestone.updateOne({ _id: input.id }, { $set: { clientVisible: input.visible } }, { session });
    } else {
      await Deliverable.updateOne({ _id: input.id }, { $set: { clientVisible: input.visible } }, { session });
    }
    await recordAudit(
      {
        actor: input.actor,
        action: "project.visibility_changed",
        target: { type: input.kind, id: input.id },
        metadata: { projectId, title, visible: input.visible },
      },
      session,
    );
    return { ok: true };
  });
}

// ---------------------------------------------------------------- staff reads

async function organizationNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(isObjectId);
  if (unique.length === 0) return new Map();
  const organizations = await Organization.find({ _id: { $in: unique } }).lean();
  return new Map(organizations.map((o) => [String(o._id), o.name]));
}

/** `onlyIds` limits the list to those projects (an empty list returns nothing). Omit it for "all projects". */
export async function listProjects(scope: { onlyIds?: string[] } = {}): Promise<ProjectView[]> {
  await connectToDatabase();
  const query = scope.onlyIds ? { _id: { $in: scope.onlyIds.filter(isObjectId) } } : {};
  const docs = await Project.find(query).sort({ updatedAt: -1 }).limit(200).lean();
  const names = await organizationNames(docs.map((d) => d.organizationId));
  return docs.map((d) => toProjectView(d, names.get(d.organizationId) ?? null));
}

export interface ProjectDetail {
  project: ProjectView;
  proposalCode: string | null;
  milestones: MilestoneView[];
  deliverables: DeliverableView[];
}

export async function getProjectForStaff(id: string): Promise<ProjectDetail | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Project.findById(id).lean();
  if (!doc) return null;
  const [names, proposal, milestones, deliverables] = await Promise.all([
    organizationNames([doc.organizationId]),
    isObjectId(doc.proposalId) ? Proposal.findById(doc.proposalId).select("code").lean() : null,
    Milestone.find({ projectId: id }).sort({ position: 1 }).lean(),
    Deliverable.find({ projectId: id }).sort({ position: 1 }).lean(),
  ]);
  return {
    project: toProjectView(doc, names.get(doc.organizationId) ?? null),
    proposalCode: proposal?.code ?? null,
    milestones: milestones.map(toMilestoneView),
    deliverables: deliverables.map(toDeliverableView),
  };
}

// ---------------------------------------------------------------- client reads (always tenant-scoped)

export interface ClientProjectSummary {
  id: string;
  code: string;
  title: string;
  summary: string;
  status: ProjectStatus;
  updatedAt: Date;
}

export async function listClientProjects(organizationId: string): Promise<ClientProjectSummary[]> {
  await connectToDatabase();
  const docs = await Project.find(clientProjectFilter(organizationId)).sort({ updatedAt: -1 }).lean();
  return docs.map((doc) => ({
    id: String(doc._id),
    code: doc.code,
    title: doc.title,
    summary: doc.summary,
    status: doc.status,
    updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
  }));
}

export interface ClientProjectDetail {
  project: {
    id: string;
    code: string;
    title: string;
    summary: string;
    status: ProjectStatus;
    startedAt: Date | null;
    completedAt: Date | null;
  };
  milestones: MilestoneView[];
  deliverables: DeliverableView[];
  progress: { done: number; total: number; percent: number };
}

/**
 * Returns null for a malformed id or ANOTHER organization's project (the two look the same), and only ever
 * returns the milestones and deliverables that staff have made visible to the client.
 */
export async function getClientProject(
  organizationId: string,
  id: string,
): Promise<ClientProjectDetail | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Project.findOne(clientProjectFilter(organizationId, id)).lean();
  if (!doc) return null;
  const visible = clientVisibleChildFilter(String(doc._id));
  const [milestones, deliverables] = await Promise.all([
    Milestone.find(visible).sort({ position: 1 }).lean(),
    Deliverable.find(visible).sort({ position: 1 }).lean(),
  ]);
  const milestoneViews = milestones.map(toMilestoneView);
  return {
    project: {
      id: String(doc._id),
      code: doc.code,
      title: doc.title,
      summary: doc.summary,
      status: doc.status,
      startedAt: doc.startedAt ?? null,
      completedAt: doc.completedAt ?? null,
    },
    milestones: milestoneViews,
    deliverables: deliverables.map(toDeliverableView),
    progress: milestoneProgress(milestoneViews.map((m) => m.status)),
  };
}
