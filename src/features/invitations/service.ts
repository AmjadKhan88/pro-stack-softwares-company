import "server-only";
import mongoose from "mongoose";
import { recordAudit } from "@/features/audit/service";
import type { AuditActor } from "@/features/audit/types";
import { connectToDatabase } from "@/server/db/mongoose";
import { getMongoDb } from "@/server/db/mongo-client";
import { Invitation } from "./models/invitation";
import { INVITE_TTL_MS, isInviteUsable, type InvitableRole } from "./rules";
import { generateInviteToken, hashInviteToken } from "./tokens";

export type CreateInvitationResult =
  | { ok: true; token: string; invitationId: string; expiresAt: Date }
  | { ok: false; reason: "account-exists" };

/** Revokes older pending invites for the address, creates the new one and audits it in ONE transaction. */
export async function createInvitation(input: {
  actor: AuditActor;
  email: string;
  role: InvitableRole;
}): Promise<CreateInvitationResult> {
  await connectToDatabase();
  if (await getMongoDb().collection("user").findOne({ email: input.email })) {
    return { ok: false, reason: "account-exists" };
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const session = await mongoose.startSession();
  try {
    let invitationId = "";
    await session.withTransaction(async () => {
      await Invitation.updateMany(
        { email: input.email, status: "pending" },
        { $set: { status: "revoked", revokedAt: new Date() } },
        { session },
      );
      const [created] = await Invitation.create(
        [
          {
            email: input.email,
            role: input.role,
            tokenHash: hashInviteToken(token),
            status: "pending",
            invitedBy: input.actor.id,
            invitedByEmail: input.actor.email,
            expiresAt,
          },
        ],
        { session },
      );
      invitationId = String(created._id);
      await recordAudit(
        {
          actor: input.actor,
          action: "invitation.created",
          target: { type: "invitation", id: invitationId },
          metadata: { email: input.email, role: input.role },
        },
        session,
      );
    });
    return { ok: true, token, invitationId, expiresAt };
  } finally {
    await session.endSession();
  }
}

export interface UsableInvitation {
  id: string;
  email: string;
  role: InvitableRole;
}

/** Looks an invitation up by its link token WITHOUT using it up (for showing the accept form). */
export async function peekInvitation(token: string): Promise<UsableInvitation | null> {
  await connectToDatabase();
  const invite = await Invitation.findOne({ tokenHash: hashInviteToken(token) }).lean();
  if (!invite || !isInviteUsable(invite)) return null;
  return { id: String(invite._id), email: invite.email, role: invite.role };
}

/** Atomically uses the invitation up: only one request can ever succeed for a given link. */
export async function claimInvitation(token: string): Promise<UsableInvitation | null> {
  await connectToDatabase();
  const now = new Date();
  const invite = await Invitation.findOneAndUpdate(
    { tokenHash: hashInviteToken(token), status: "pending", expiresAt: { $gt: now } },
    { $set: { status: "accepted", acceptedAt: now } },
    { returnDocument: "after" },
  ).lean();
  return invite ? { id: String(invite._id), email: invite.email, role: invite.role } : null;
}

/** Puts a claimed invitation back if account creation failed, so the person can try again. */
export async function releaseInvitation(id: string): Promise<void> {
  await connectToDatabase();
  await Invitation.updateOne(
    { _id: id, status: "accepted" },
    { $set: { status: "pending" }, $unset: { acceptedAt: 1 } },
  );
}

export async function revokeInvitation(id: string, actor: AuditActor): Promise<boolean> {
  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    let revoked = false;
    await session.withTransaction(async () => {
      const result = await Invitation.updateOne(
        { _id: id, status: "pending" },
        { $set: { status: "revoked", revokedAt: new Date() } },
        { session },
      );
      revoked = result.modifiedCount === 1;
      if (revoked) {
        await recordAudit(
          { actor, action: "invitation.revoked", target: { type: "invitation", id } },
          session,
        );
      }
    });
    return revoked;
  } finally {
    await session.endSession();
  }
}

export interface InvitationRow {
  id: string;
  email: string;
  role: InvitableRole;
  status: "pending" | "accepted" | "revoked";
  invitedByEmail: string;
  expiresAt: Date;
}

export async function listInvitations(limit = 50): Promise<InvitationRow[]> {
  await connectToDatabase();
  const rows = await Invitation.find().sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((row) => ({
    id: String(row._id),
    email: row.email,
    role: row.role,
    status: row.status,
    invitedByEmail: row.invitedByEmail,
    expiresAt: row.expiresAt,
  }));
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  twoFactorEnabled: boolean;
  banned: boolean;
}

/** Reads accounts from Better Auth's own "user" collection (read-only; role changes come in Phase 5). */
export async function listUsers(limit = 100): Promise<UserRow[]> {
  const rows = await getMongoDb()
    .collection("user")
    .find({}, { projection: { name: 1, email: 1, role: 1, twoFactorEnabled: 1, banned: 1 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return rows.map((row) => ({
    id: String(row._id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: typeof row.role === "string" ? row.role : null,
    twoFactorEnabled: row.twoFactorEnabled === true,
    banned: row.banned === true,
  }));
}
