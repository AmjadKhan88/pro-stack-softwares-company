import "server-only";
import type { QueryFilter } from "mongoose";
import { listAuditLogs, type AuditRow } from "@/features/audit/service";
import { Lead } from "@/features/leads/models/lead";
import { normalizeLeadStatus, type LeadStatus } from "@/features/leads/pipeline";
import { Organization } from "@/features/organizations/models/organization";
import { Deliverable } from "@/features/projects/models/deliverable";
import { Project, type ProjectDoc } from "@/features/projects/models/project";
import { clientProjectFilter, type ProjectStatus } from "@/features/projects/status";
import { Proposal } from "@/features/proposals/models/proposal";
import { clientProposalFilter } from "@/features/proposals/status";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import type { DashboardSections } from "./sections";

export interface RecentLead {
  id: string;
  referenceCode: string;
  name: string;
  company: string | null;
  status: LeadStatus;
  createdAt: Date;
}

export interface AdminSummary {
  leads: { newCount: number; qualifiedCount: number; recent: RecentLead[] } | null;
  proposals: { awaitingClient: number; readyToConvert: number } | null;
  projects: { active: number; waitingOnClient: number; changesRequested: number } | null;
  organizations: number | null;
  activity: AuditRow[] | null;
}

const OPEN: ProjectStatus[] = ["planning", "active", "on_hold"];

async function leadsSummary(): Promise<NonNullable<AdminSummary["leads"]>> {
  const live = { archivedAt: { $exists: false } };
  const [newCount, qualifiedCount, recent] = await Promise.all([
    Lead.countDocuments({ ...live, status: "new" }),
    Lead.countDocuments({ ...live, status: "qualified" }),
    Lead.find(live).sort({ createdAt: -1 }).limit(5).lean(),
  ]);
  return {
    newCount,
    qualifiedCount,
    recent: recent.map((lead) => ({
      id: String(lead._id),
      referenceCode: lead.referenceCode,
      name: lead.name,
      company: lead.company ?? null,
      status: normalizeLeadStatus(lead.status),
      createdAt: (lead as unknown as { createdAt: Date }).createdAt,
    })),
  };
}

async function proposalsSummary(now: Date): Promise<NonNullable<AdminSummary["proposals"]>> {
  const [awaitingClient, readyToConvert] = await Promise.all([
    Proposal.countDocuments({ status: "sent", expiresAt: { $gt: now } }),
    Proposal.countDocuments({ status: "accepted", projectId: { $exists: false } }),
  ]);
  return { awaitingClient, readyToConvert };
}

/** `projectIds` null means every project; otherwise only those (a developer's assigned projects). */
async function projectsSummary(projectIds: string[] | null): Promise<NonNullable<AdminSummary["projects"]>> {
  const scope: QueryFilter<ProjectDoc> =
    projectIds === null ? {} : { _id: { $in: projectIds.filter(isObjectId) } };
  const open = await Project.find({ ...scope, status: { $in: OPEN } })
    .select("status")
    .lean();
  const openIds = open.map((project) => String(project._id));
  if (openIds.length === 0) return { active: 0, waitingOnClient: 0, changesRequested: 0 };
  const [waitingOnClient, changesRequested] = await Promise.all([
    Deliverable.countDocuments({ projectId: { $in: openIds }, reviewStatus: "in_review" }),
    Deliverable.countDocuments({ projectId: { $in: openIds }, reviewStatus: "changes_requested" }),
  ]);
  return {
    active: open.filter((project) => project.status === "active").length,
    waitingOnClient,
    changesRequested,
  };
}

export async function getAdminSummary(input: {
  sections: DashboardSections;
  projectIds: string[] | null;
}): Promise<AdminSummary> {
  await connectToDatabase();
  const now = new Date();
  const [leads, proposals, projects, organizations, activity] = await Promise.all([
    input.sections.leads ? leadsSummary() : null,
    input.sections.proposals ? proposalsSummary(now) : null,
    input.sections.projects ? projectsSummary(input.projectIds) : null,
    input.sections.clients ? Organization.countDocuments({ status: "active" }) : null,
    input.sections.activity ? listAuditLogs(8) : null,
  ]);
  return { leads, proposals, projects, organizations, activity };
}

// ---------------------------------------------------------------- client dashboard

export interface ClientSummary {
  activeProjects: number;
  proposalsToReview: { id: string; title: string; code: string; expiresAt: Date | null }[];
  deliverablesToReview: { id: string; title: string; projectId: string; projectTitle: string }[];
}

/** Everything here starts from the client's own organization (taken from their account), never from the request. */
export async function getClientSummary(organizationId: string): Promise<ClientSummary> {
  await connectToDatabase();
  const now = new Date();
  const [projects, proposals] = await Promise.all([
    Project.find({ ...clientProjectFilter(organizationId), status: { $in: OPEN } })
      .select("title status")
      .lean(),
    Proposal.find({ ...clientProposalFilter(organizationId), status: "sent", expiresAt: { $gt: now } })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean(),
  ]);
  const projectIds = projects.map((project) => String(project._id));
  const titles = new Map(projects.map((project) => [String(project._id), project.title]));
  // projectIds come from the organization-scoped query above, so these deliverables are this client's own.
  const deliverables = projectIds.length
    ? await Deliverable.find({
        projectId: { $in: projectIds },
        clientVisible: true,
        reviewStatus: "in_review",
      })
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean()
    : [];

  return {
    activeProjects: projects.filter((project) => project.status === "active").length,
    proposalsToReview: proposals.map((proposal) => ({
      id: String(proposal._id),
      title: proposal.title,
      code: proposal.code,
      expiresAt: proposal.expiresAt ?? null,
    })),
    deliverablesToReview: deliverables.map((deliverable) => ({
      id: String(deliverable._id),
      title: deliverable.title,
      projectId: deliverable.projectId,
      projectTitle: titles.get(deliverable.projectId) ?? "Project",
    })),
  };
}
