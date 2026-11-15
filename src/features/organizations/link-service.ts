import "server-only";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { recordAudit } from "@/features/audit/service";
import type { AuditActor } from "@/features/audit/types";
import { isObjectId } from "@/lib/object-id";
import { getMongoDb } from "@/server/db/mongo-client";
import { connectToDatabase } from "@/server/db/mongoose";
import { Organization } from "./models/organization";
import { OrganizationMember } from "./models/organization-member";

export interface UnlinkedClient {
  id: string;
  name: string;
  email: string;
}

/** Client accounts that don't belong to any organization yet. */
export async function listUnlinkedClients(): Promise<UnlinkedClient[]> {
  await connectToDatabase();
  const clients = await getMongoDb()
    .collection("user")
    .find({ role: "client" }, { projection: { name: 1, email: 1 } })
    .sort({ name: 1 })
    .limit(500)
    .toArray();
  const ids = clients.map((c) => String(c._id));
  const linked = new Set(
    (
      await OrganizationMember.find({ userId: { $in: ids } })
        .select("userId")
        .lean()
    ).map((m) => m.userId),
  );
  return clients
    .filter((c) => !linked.has(String(c._id)))
    .map((c) => ({ id: String(c._id), name: String(c.name ?? ""), email: String(c.email ?? "") }));
}

export type LinkResult =
  | { ok: true }
  | { ok: false; reason: "organization-not-found" | "user-not-found" | "not-a-client" | "already-linked" };

/** Links an existing client account to an organization (one organization per account). Audited in the same transaction. */
export async function linkExistingClient(input: {
  actor: AuditActor;
  organizationId: string;
  userId: string;
}): Promise<LinkResult> {
  await connectToDatabase();
  const user = isObjectId(input.userId)
    ? await getMongoDb()
        .collection("user")
        .findOne({ _id: new ObjectId(input.userId) }, { projection: { email: 1, role: 1 } })
    : null;
  if (!user) return { ok: false, reason: "user-not-found" };
  if (user.role !== "client") return { ok: false, reason: "not-a-client" };

  const session = await mongoose.startSession();
  try {
    let result: LinkResult = { ok: false, reason: "organization-not-found" };
    await session.withTransaction(async () => {
      const organization = await Organization.findById(input.organizationId).session(session);
      if (!organization || organization.status !== "active") {
        result = { ok: false, reason: "organization-not-found" };
        return;
      }
      if (await OrganizationMember.exists({ userId: input.userId }).session(session)) {
        result = { ok: false, reason: "already-linked" };
        return;
      }
      await OrganizationMember.create(
        [{ organizationId: input.organizationId, userId: input.userId, role: "member" }],
        { session },
      );
      await recordAudit(
        {
          actor: input.actor,
          action: "organization.member_added",
          target: { type: "organization", id: input.organizationId },
          metadata: { userId: input.userId, memberEmail: String(user.email), linkedExistingAccount: true },
        },
        session,
      );
      result = { ok: true };
    });
    return result;
  } catch (error) {
    // The unique index on the membership's userId is the final guard if two people link at once.
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return { ok: false, reason: "already-linked" };
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
