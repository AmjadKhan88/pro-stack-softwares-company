import "server-only";
import { ObjectId } from "mongodb";
import { recordAuditNative } from "@/features/audit/native";
import type { AuditActor } from "@/features/audit/types";
import { Organization } from "@/features/organizations/models/organization";
import { OrganizationMember } from "@/features/organizations/models/organization-member";
import { ProjectMember } from "@/features/projects/models/project-member";
import { isObjectId } from "@/lib/object-id";
import { PAGE_SIZE, escapeRegex } from "@/lib/search";
import { getMongoClient, getMongoDb } from "@/server/db/mongo-client";
import { connectToDatabase } from "@/server/db/mongoose";
import { checkDisable, checkRoleChange, endsProjectAssignments, type Denial } from "./rules";
import type { AccountFilters } from "./schema";

export interface AccountRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  disabled: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date | null;
}

const PROJECTION = { name: 1, email: 1, role: 1, banned: 1, twoFactorEnabled: 1, createdAt: 1 };

function toRow(doc: Record<string, unknown>): AccountRow {
  return {
    id: String(doc._id),
    name: String(doc.name ?? ""),
    email: String(doc.email ?? ""),
    role: typeof doc.role === "string" ? doc.role : null,
    disabled: doc.banned === true,
    twoFactorEnabled: doc.twoFactorEnabled === true,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : null,
  };
}

export interface AccountList {
  rows: AccountRow[];
  total: number;
  page: number;
  pageCount: number;
}

/** Searchable, filterable, paginated. Search text is escaped, so it can never act as a pattern. */
export async function listAccounts(filters: AccountFilters): Promise<AccountList> {
  const query: Record<string, unknown> = {};
  if (filters.role) query.role = filters.role;
  if (filters.status === "disabled") query.banned = true;
  if (filters.status === "active") query.banned = { $ne: true };
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [{ name: pattern }, { email: pattern }];
  }

  const users = getMongoDb().collection("user");
  const total = await users.countDocuments(query);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const docs = await users
    .find(query, { projection: PROJECTION })
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .toArray();
  return { rows: docs.map(toRow), total, page, pageCount };
}

/** Active (not disabled) owners: the number the "last owner" rule depends on. */
export async function countOwners(): Promise<number> {
  return getMongoDb()
    .collection("user")
    .countDocuments({ role: "owner", banned: { $ne: true } });
}

export interface AccountDetail extends AccountRow {
  emailVerified: boolean;
  banReason: string | null;
  organization: { id: string; name: string } | null;
  projectCount: number;
}

export async function getAccount(id: string): Promise<AccountDetail | null> {
  if (!isObjectId(id)) return null;
  const doc = await getMongoDb()
    .collection("user")
    .findOne({ _id: new ObjectId(id) }, { projection: { ...PROJECTION, emailVerified: 1, banReason: 1 } });
  if (!doc) return null;
  await connectToDatabase();
  const row = toRow(doc);
  let organization: AccountDetail["organization"] = null;
  if (row.role === "client") {
    const membership = await OrganizationMember.findOne({ userId: id }).lean();
    const org = membership ? await Organization.findById(membership.organizationId).lean() : null;
    if (org) organization = { id: String(org._id), name: org.name };
  }
  return {
    ...row,
    emailVerified: doc.emailVerified === true,
    banReason: typeof doc.banReason === "string" ? doc.banReason : null,
    organization,
    projectCount: await ProjectMember.countDocuments({ userId: id }),
  };
}

export type AccountResult = { ok: true } | { ok: false; reason: Denial | "not-found" | "changed-elsewhere" };

interface Actor extends AuditActor {
  role: unknown;
}

/**
 * Changes a staff member's role. The rules are checked first; then the role update, the removal of any project
 * assignments that no longer apply and the audit record all commit in ONE transaction.
 */
export async function changeUserRole(input: {
  actor: Actor;
  targetId: string;
  newRole: string;
}): Promise<AccountResult> {
  if (!isObjectId(input.targetId)) return { ok: false, reason: "not-found" };
  const db = getMongoDb();
  const target = await db
    .collection("user")
    .findOne({ _id: new ObjectId(input.targetId) }, { projection: { email: 1, role: 1 } });
  if (!target) return { ok: false, reason: "not-found" };

  const check = checkRoleChange({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    targetId: input.targetId,
    targetRole: target.role,
    ownerCount: await countOwners(),
    newRole: input.newRole,
  });
  if (!check.ok) return check;

  const session = getMongoClient().startSession();
  try {
    let result: AccountResult = { ok: false, reason: "changed-elsewhere" };
    await session.withTransaction(async () => {
      // Only applies if the role is still what we checked, so two admins can't overwrite each other.
      const updated = await db
        .collection("user")
        .updateOne(
          { _id: target._id, role: target.role },
          { $set: { role: input.newRole, updatedAt: new Date() } },
          { session },
        );
      if (updated.modifiedCount !== 1) {
        result = { ok: false, reason: "changed-elsewhere" };
        return;
      }
      let removedAssignments = 0;
      if (endsProjectAssignments(input.newRole)) {
        const removed = await db
          .collection("projectmembers")
          .deleteMany({ userId: input.targetId }, { session });
        removedAssignments = removed.deletedCount;
      }
      await recordAuditNative(
        {
          actor: { id: input.actor.id, email: input.actor.email },
          action: "user.role_changed",
          target: { type: "user", id: input.targetId },
          metadata: {
            email: String(target.email),
            from: typeof target.role === "string" ? target.role : null,
            to: input.newRole,
            removedProjectAssignments: removedAssignments,
          },
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

/**
 * Disables or re-enables an account. Disabling also deletes every session the person has, so it takes effect on
 * their very next request, and the flag, the sessions and the audit record change together.
 */
export async function setAccountDisabled(input: {
  actor: Actor;
  targetId: string;
  disable: boolean;
  reason?: string;
}): Promise<AccountResult> {
  if (!isObjectId(input.targetId)) return { ok: false, reason: "not-found" };
  const db = getMongoDb();
  const target = await db
    .collection("user")
    .findOne({ _id: new ObjectId(input.targetId) }, { projection: { email: 1, role: 1, banned: 1 } });
  if (!target) return { ok: false, reason: "not-found" };

  const check = checkDisable({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    targetId: input.targetId,
    targetRole: target.role,
    ownerCount: await countOwners(),
  });
  if (!check.ok) return check;

  const session = getMongoClient().startSession();
  try {
    let result: AccountResult = { ok: false, reason: "changed-elsewhere" };
    await session.withTransaction(async () => {
      const wasDisabled = target.banned === true;
      const update = input.disable
        ? {
            $set: {
              banned: true,
              banReason: input.reason ?? "Disabled by an administrator",
              updatedAt: new Date(),
            },
            $unset: { banExpires: 1 },
          }
        : { $set: { banned: false, updatedAt: new Date() }, $unset: { banReason: 1, banExpires: 1 } };
      const updated = await db
        .collection("user")
        .updateOne({ _id: target._id, banned: wasDisabled ? true : { $ne: true } }, update, { session });
      if (updated.matchedCount !== 1) {
        result = { ok: false, reason: "changed-elsewhere" };
        return;
      }
      let revokedSessions = 0;
      if (input.disable) {
        // Sessions reference the user either as text or as an ObjectId depending on the adapter, so match both.
        const removed = await db
          .collection("session")
          .deleteMany({ userId: { $in: [input.targetId, new ObjectId(input.targetId)] } }, { session });
        revokedSessions = removed.deletedCount;
      }
      await recordAuditNative(
        {
          actor: { id: input.actor.id, email: input.actor.email },
          action: input.disable ? "user.disabled" : "user.enabled",
          target: { type: "user", id: input.targetId },
          metadata: {
            email: String(target.email),
            role: typeof target.role === "string" ? target.role : null,
            ...(input.disable ? { reason: input.reason ?? null, revokedSessions } : {}),
          },
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
