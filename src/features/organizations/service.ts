import "server-only";
import { ObjectId } from "mongodb";
import mongoose, { type ClientSession } from "mongoose";
import { recordAudit } from "@/features/audit/service";
import type { AuditActor } from "@/features/audit/types";
import { Invitation } from "@/features/invitations/models/invitation";
import { isObjectId } from "@/lib/object-id";
import { getMongoDb } from "@/server/db/mongo-client";
import { connectToDatabase } from "@/server/db/mongoose";
import { Organization } from "./models/organization";
import { OrganizationMember } from "./models/organization-member";

export interface OrganizationSummary {
  id: string;
  name: string;
  contactEmail: string | null;
  status: "active" | "archived";
  memberCount: number;
  createdAt: Date;
}

export async function createOrganization(input: {
  actor: AuditActor;
  name: string;
  contactEmail?: string;
}): Promise<{ id: string }> {
  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    let id = "";
    await session.withTransaction(async () => {
      const [created] = await Organization.create(
        [
          {
            name: input.name,
            contactEmail: input.contactEmail,
            status: "active",
            createdBy: input.actor.id,
            createdByEmail: input.actor.email,
          },
        ],
        { session },
      );
      id = String(created._id);
      await recordAudit(
        {
          actor: input.actor,
          action: "organization.created",
          target: { type: "organization", id },
          metadata: { name: input.name },
        },
        session,
      );
    });
    return { id };
  } finally {
    await session.endSession();
  }
}

export async function listOrganizations(): Promise<OrganizationSummary[]> {
  await connectToDatabase();
  const [organizations, counts] = await Promise.all([
    Organization.find().sort({ createdAt: -1 }).limit(200).lean(),
    OrganizationMember.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$organizationId", count: { $sum: 1 } } },
    ]),
  ]);
  const byOrganization = new Map(counts.map((row) => [row._id, row.count]));
  return organizations.map((org) => ({
    id: String(org._id),
    name: org.name,
    contactEmail: org.contactEmail ?? null,
    status: org.status,
    memberCount: byOrganization.get(String(org._id)) ?? 0,
    createdAt: (org as unknown as { createdAt: Date }).createdAt,
  }));
}

export interface OrganizationDetail {
  id: string;
  name: string;
  contactEmail: string | null;
  status: "active" | "archived";
  createdByEmail: string;
  createdAt: Date;
}

/** Returns null for malformed ids as well as unknown ones, so callers can simply 404. */
export async function getOrganization(id: string): Promise<OrganizationDetail | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const org = await Organization.findById(id).lean();
  if (!org) return null;
  return {
    id: String(org._id),
    name: org.name,
    contactEmail: org.contactEmail ?? null,
    status: org.status,
    createdByEmail: org.createdByEmail,
    createdAt: (org as unknown as { createdAt: Date }).createdAt,
  };
}

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
}

export async function listMembers(organizationId: string): Promise<MemberRow[]> {
  await connectToDatabase();
  const memberships = await OrganizationMember.find({ organizationId }).sort({ createdAt: 1 }).lean();
  const ids = memberships.map((m) => m.userId).filter(isObjectId);
  if (ids.length === 0) return [];
  const users = await getMongoDb()
    .collection("user")
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { name: 1, email: 1 } })
    .toArray();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return memberships.map((m) => ({
    userId: m.userId,
    name: String(byId.get(m.userId)?.name ?? "Unknown user"),
    email: String(byId.get(m.userId)?.email ?? ""),
  }));
}

/** Links a client account to its organization. Safe to call twice (it never creates a second membership). */
export async function addMember(
  input: { organizationId: string; userId: string; actor: AuditActor },
  session?: ClientSession,
): Promise<void> {
  await connectToDatabase();
  const result = await OrganizationMember.updateOne(
    { userId: input.userId },
    { $setOnInsert: { organizationId: input.organizationId, role: "member" } },
    { upsert: true, session },
  );
  if (result.upsertedCount === 1) {
    await recordAudit(
      {
        actor: input.actor,
        action: "organization.member_added",
        target: { type: "organization", id: input.organizationId },
        metadata: { userId: input.userId },
      },
      session,
    );
  }
}

export interface ClientMembership {
  organizationId: string;
}

/**
 * The ONLY way client-facing code learns which organization a signed-in client belongs to.
 * Every client query in the portal must be scoped to the id returned here, never to an id from the URL or form.
 */
export async function getClientMembership(userId: string, email: string): Promise<ClientMembership | null> {
  await connectToDatabase();
  const existing = await OrganizationMember.findOne({ userId }).lean();
  if (existing) return { organizationId: existing.organizationId };

  // Self-healing: the person accepted a client invitation but linking the organization failed at that moment.
  const invite = await Invitation.findOne({ email, status: "accepted", organizationId: { $exists: true } })
    .sort({ acceptedAt: -1 })
    .lean();
  if (!invite?.organizationId) return null;
  await OrganizationMember.updateOne(
    { userId },
    { $setOnInsert: { organizationId: invite.organizationId, role: "member" } },
    { upsert: true },
  );
  return { organizationId: invite.organizationId };
}
