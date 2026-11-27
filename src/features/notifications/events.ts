import "server-only";
import { ObjectId } from "mongodb";
import type { ClientSession } from "mongoose";
import type { AuditAction, AuditActor, AuditTarget } from "@/features/audit/types";
import { ProjectFile } from "@/features/files/models/project-file";
import { Lead } from "@/features/leads/models/lead";
import { OrganizationMember } from "@/features/organizations/models/organization-member";
import { Deliverable } from "@/features/projects/models/deliverable";
import { Project } from "@/features/projects/models/project";
import { ProjectMember } from "@/features/projects/models/project-member";
import { PROJECT_STATUS_LABELS, isProjectStatus } from "@/features/projects/status";
import { Proposal } from "@/features/proposals/models/proposal";
import { isObjectId } from "@/lib/object-id";
import { getMongoDb } from "@/server/db/mongo-client";
import { logger } from "@/server/logger";
import { ROLES, can, type Permission } from "@/server/policies/permissions";
import { buildContent, type ContentFacts } from "./content";
import { scheduleEmailDispatch } from "./email";
import { Notification } from "./models/notification";
import { NotificationPreference } from "./models/notification-preference";
import { KIND_CATEGORY, wantsEmail, type EmailPreferences, type NotificationKind } from "./types";

interface Entry {
  action: AuditAction;
  actor: AuditActor | null;
  target?: AuditTarget;
  metadata?: Record<string, unknown>;
}

interface Planned {
  kind: NotificationKind;
  recipients: string[];
  facts: ContentFacts;
  entityType: string;
  entityId: string;
}

async function orgMemberIds(organizationId: string, session: ClientSession | null): Promise<string[]> {
  const members = await OrganizationMember.find({ organizationId }).session(session).select("userId").lean();
  return members.map((member) => member.userId);
}

async function projectTeamIds(project: { _id: unknown; createdBy: string }, session: ClientSession | null) {
  const members = await ProjectMember.find({ projectId: String(project._id) })
    .session(session)
    .select("userId")
    .lean();
  return [...members.map((member) => member.userId), project.createdBy];
}

async function staffIdsWith(permission: Permission): Promise<string[]> {
  const roles = ROLES.filter((role) => can(role, permission));
  const users = await getMongoDb()
    .collection("user")
    .find({ role: { $in: [...roles] }, banned: { $ne: true } }, { projection: { _id: 1 } })
    .limit(200)
    .toArray();
  return users.map((user) => String(user._id));
}

/** Decides who should hear about an audited event. Returns null when nobody should. */
async function plan(entry: Entry, session: ClientSession | null): Promise<Planned | null> {
  const targetId = entry.target?.id;
  if (!targetId || !isObjectId(targetId)) return null;
  const meta = entry.metadata ?? {};

  switch (entry.action) {
    case "proposal.sent": {
      const proposal = await Proposal.findById(targetId).session(session).lean();
      if (!proposal) return null;
      return {
        kind: "proposal_sent",
        recipients: await orgMemberIds(proposal.organizationId, session),
        facts: { id: targetId, label: proposal.title },
        entityType: "proposal",
        entityId: targetId,
      };
    }
    case "proposal.accepted":
    case "proposal.declined": {
      const proposal = await Proposal.findById(targetId).session(session).lean();
      if (!proposal) return null;
      return {
        kind: entry.action === "proposal.accepted" ? "proposal_accepted" : "proposal_declined",
        recipients: [proposal.createdBy],
        facts: { id: targetId, label: `${proposal.title} (${proposal.code})` },
        entityType: "proposal",
        entityId: targetId,
      };
    }
    case "deliverable.review_submitted":
    case "deliverable.review_approved":
    case "deliverable.review_changes_requested": {
      const deliverable = await Deliverable.findById(targetId).session(session).lean();
      if (!deliverable || !isObjectId(deliverable.projectId)) return null;
      const project = await Project.findById(deliverable.projectId).session(session).lean();
      if (!project) return null;
      const toClient = entry.action === "deliverable.review_submitted";
      return {
        kind: toClient
          ? "review_requested"
          : entry.action === "deliverable.review_approved"
            ? "review_approved"
            : "review_changes_requested",
        recipients: toClient
          ? await orgMemberIds(project.organizationId, session)
          : await projectTeamIds(project, session),
        facts: { projectId: String(project._id), label: deliverable.title },
        entityType: "deliverable",
        entityId: targetId,
      };
    }
    case "file.uploaded":
    case "file.visibility_changed": {
      // Only when a file is being SHOWN to the client.
      const shown = entry.action === "file.uploaded" ? meta.clientVisible === true : meta.visible === true;
      if (!shown) return null;
      const file = await ProjectFile.findById(targetId).session(session).lean();
      if (!file || file.status !== "active" || !file.clientVisible) return null;
      if (file.deliverableId && isObjectId(file.deliverableId)) {
        const deliverable = await Deliverable.findById(file.deliverableId)
          .session(session)
          .select("clientVisible")
          .lean();
        if (!deliverable?.clientVisible) return null; // the client can't see that deliverable, so no news about its files
      }
      return {
        kind: "file_shared",
        recipients: await orgMemberIds(file.organizationId, session),
        facts: { label: file.originalFilename },
        entityType: "file",
        entityId: targetId,
      };
    }
    case "project.created": {
      const project = await Project.findById(targetId).session(session).lean();
      if (!project) return null;
      return {
        kind: "project_started",
        recipients: await orgMemberIds(project.organizationId, session),
        facts: { id: targetId, label: project.title },
        entityType: "project",
        entityId: targetId,
      };
    }
    case "project.status_changed": {
      const to = meta.to;
      if (
        to !== "active" &&
        to !== "on_hold" &&
        to !== "completed" &&
        !(isProjectStatus(to) && to === "cancelled")
      )
        return null;
      const project = await Project.findById(targetId).session(session).lean();
      if (!project) return null;
      return {
        kind: "project_status",
        recipients: await orgMemberIds(project.organizationId, session),
        facts: { id: targetId, label: project.title, status: PROJECT_STATUS_LABELS[to].toLowerCase() },
        entityType: "project",
        entityId: targetId,
      };
    }
    case "project.member_assigned": {
      const userId = meta.userId;
      if (typeof userId !== "string") return null;
      const project = await Project.findById(targetId).session(session).lean();
      if (!project) return null;
      return {
        kind: "added_to_project",
        recipients: [userId],
        facts: { id: targetId, label: project.title },
        entityType: "project",
        entityId: targetId,
      };
    }
    case "lead.created_from_portal": {
      const lead = await Lead.findById(targetId).session(session).lean();
      if (!lead) return null;
      return {
        kind: "new_request",
        recipients: await staffIdsWith("leads.manage"),
        facts: { id: targetId, label: lead.company ?? lead.name },
        entityType: "lead",
        entityId: targetId,
      };
    }
    default:
      return null;
  }
}

async function deliver(
  planned: Planned,
  actorId: string | undefined,
  auditId: string | undefined,
  session: ClientSession | null,
) {
  // Never notify the person who did it, and only people who still have an active account.
  const ids = [...new Set(planned.recipients)].filter((id) => isObjectId(id) && id !== actorId);
  if (ids.length === 0) return;
  const users = await getMongoDb()
    .collection("user")
    .find(
      { _id: { $in: ids.map((id) => new ObjectId(id)) }, banned: { $ne: true } },
      { projection: { role: 1 } },
    )
    .toArray();
  if (users.length === 0) return;

  const prefs = await NotificationPreference.find({ userId: { $in: ids } })
    .session(session)
    .lean();
  const byUser = new Map(prefs.map((pref) => [pref.userId, pref.email as EmailPreferences]));
  const category = KIND_CATEGORY[planned.kind];
  const content = buildContent(planned.kind, planned.facts);

  const docs = users.map((user) => {
    const id = String(user._id);
    return {
      recipientId: id,
      kind: planned.kind,
      category,
      ...content,
      entityType: planned.entityType,
      entityId: planned.entityId,
      ...(auditId ? { auditId } : {}),
      emailStatus: wantsEmail(user.role, category, byUser.get(id)) ? ("pending" as const) : ("none" as const),
      emailAttempts: 0,
    };
  });
  await Notification.create(docs, { session: session ?? undefined, ordered: true });
  if (docs.some((doc) => doc.emailStatus === "pending")) scheduleEmailDispatch();
}

/**
 * Called from recordAudit, INSIDE the same transaction as the change. The notification is saved or lost together
 * with the thing that caused it. Problems working out who to tell are logged and never break the change itself.
 */
export async function notifyForAudit(
  entry: Entry,
  auditId: string | undefined,
  session?: ClientSession,
): Promise<void> {
  const s = session ?? null;
  let planned: Planned | null = null;
  try {
    planned = await plan(entry, s);
  } catch (error) {
    logger.error({ err: error, action: entry.action }, "could not work out who to notify");
    return;
  }
  if (planned) await deliver(planned, entry.actor?.id, auditId, s);
}

/** A website enquiry is not audited, so it is announced directly (best effort, after the lead is saved). */
export async function notifyNewWebsiteLead(lead: { id: string; label: string }): Promise<void> {
  try {
    await deliver(
      {
        kind: "new_lead",
        recipients: await staffIdsWith("leads.manage"),
        facts: { id: lead.id, label: lead.label },
        entityType: "lead",
        entityId: lead.id,
      },
      undefined,
      undefined,
      null,
    );
  } catch (error) {
    logger.error({ err: error }, "could not notify staff of a new website lead");
  }
}

/**
 * Tells the other side about a new message, INSIDE the message's own transaction. A person with an unread
 * notification for this conversation isn't sent another until they have read it, so nobody is flooded.
 * The notification (and any email) never contains the message itself.
 */
export async function notifyMessage(input: {
  projectId: string;
  side: "client" | "staff";
  actorId: string;
  session: ClientSession;
}): Promise<void> {
  const project = await Project.findById(input.projectId).session(input.session).lean();
  if (!project) return;
  const toClient = input.side === "staff";
  const recipients = toClient
    ? await orgMemberIds(project.organizationId, input.session)
    : await projectTeamIds(project, input.session);
  const kind: NotificationKind = toClient ? "message_from_team" : "message_from_client";

  const waiting = await Notification.find({
    kind,
    entityId: input.projectId,
    readAt: { $exists: false },
    recipientId: { $in: recipients },
  })
    .session(input.session)
    .select("recipientId")
    .lean();
  const alreadyTold = new Set(waiting.map((doc) => doc.recipientId));

  await deliver(
    {
      kind,
      recipients: recipients.filter((id) => !alreadyTold.has(id)),
      facts: { projectId: input.projectId, label: project.title },
      entityType: "project",
      entityId: input.projectId,
    },
    input.actorId,
    undefined,
    input.session,
  );
}
