import "server-only";
import { ObjectId } from "mongodb";
import mongoose, { type ClientSession } from "mongoose";
import { recordAudit } from "@/features/audit/service";
import type { AuditActor } from "@/features/audit/types";
import { isObjectId } from "@/lib/object-id";
import { getMongoDb } from "@/server/db/mongo-client";
import { connectToDatabase } from "@/server/db/mongoose";
import { ASSIGNABLE_ROLES, isAssignableRole } from "./access-rules";
import { Project } from "./models/project";
import { ProjectMember } from "./models/project-member";
import { isProjectOpen } from "./status";

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

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

// ---------------------------------------------------------------- membership checks

/** The ids of every project this person is a team member of. */
export async function listProjectIdsForUser(userId: string): Promise<string[]> {
  await connectToDatabase();
  const rows = await ProjectMember.find({ userId }).select("projectId").lean();
  return rows.map((row) => row.projectId);
}

export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  if (!isObjectId(projectId)) return false;
  await connectToDatabase();
  return Boolean(await ProjectMember.exists({ projectId, userId }));
}

// ---------------------------------------------------------------- reads

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: string | null;
  assignedAt: Date;
}

export async function listTeam(projectId: string): Promise<TeamMember[]> {
  if (!isObjectId(projectId)) return [];
  await connectToDatabase();
  const members = await ProjectMember.find({ projectId }).sort({ createdAt: 1 }).lean();
  const ids = members.map((m) => m.userId).filter(isObjectId);
  const users = ids.length
    ? await getMongoDb()
        .collection("user")
        .find(
          { _id: { $in: ids.map((id) => new ObjectId(id)) } },
          { projection: { name: 1, email: 1, role: 1 } },
        )
        .toArray()
    : [];
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return members.map((member) => {
    const user = byId.get(member.userId);
    return {
      userId: member.userId,
      name: String(user?.name ?? "Unknown user"),
      email: String(user?.email ?? ""),
      role: typeof user?.role === "string" ? user.role : null,
      assignedAt: (member as unknown as { createdAt: Date }).createdAt,
    };
  });
}

export interface AssignableStaff {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Active staff with a delivery role who are not already on the team. */
export async function listAssignableStaff(excludeUserIds: string[]): Promise<AssignableStaff[]> {
  const exclude = new Set(excludeUserIds);
  const rows = await getMongoDb()
    .collection("user")
    .find(
      { role: { $in: [...ASSIGNABLE_ROLES] }, banned: { $ne: true } },
      { projection: { name: 1, email: 1, role: 1 } },
    )
    .sort({ name: 1 })
    .limit(200)
    .toArray();
  return rows
    .map((row) => ({
      id: String(row._id),
      name: String(row.name ?? ""),
      email: String(row.email ?? ""),
      role: String(row.role ?? ""),
    }))
    .filter((row) => !exclude.has(row.id));
}

// ---------------------------------------------------------------- writes

export type AssignResult =
  | { ok: true }
  | { ok: false; reason: "project-not-found" | "project-closed" | "user-not-assignable" | "already-member" };

/** Adds someone to a project's team. The membership and its audit record commit together. */
export async function assignMember(input: {
  actor: AuditActor;
  projectId: string;
  userId: string;
}): Promise<AssignResult> {
  await connectToDatabase();
  if (!isObjectId(input.userId)) return { ok: false, reason: "user-not-assignable" };
  const user = await getMongoDb()
    .collection("user")
    .findOne({ _id: new ObjectId(input.userId) }, { projection: { email: 1, role: 1, banned: 1 } });
  if (!user || user.banned === true || !isAssignableRole(user.role))
    return { ok: false, reason: "user-not-assignable" };

  try {
    return await withSession<AssignResult>(async (session) => {
      const project = await Project.findById(input.projectId).session(session);
      if (!project) return { ok: false, reason: "project-not-found" };
      if (!isProjectOpen(project.status)) return { ok: false, reason: "project-closed" };

      await ProjectMember.create(
        [
          {
            projectId: input.projectId,
            userId: input.userId,
            assignedBy: input.actor.id,
            assignedByEmail: input.actor.email,
          },
        ],
        { session },
      );
      await recordAudit(
        {
          actor: input.actor,
          action: "project.member_assigned",
          target: { type: "project", id: input.projectId },
          metadata: {
            code: project.code,
            userId: input.userId,
            memberEmail: String(user.email),
            role: user.role,
          },
        },
        session,
      );
      return { ok: true };
    });
  } catch (error) {
    if (isDuplicateKey(error)) return { ok: false, reason: "already-member" };
    throw error;
  }
}

export type RemoveResult = { ok: true } | { ok: false; reason: "project-not-found" | "not-a-member" };

/** Removing is allowed even on a closed project: it is how access is taken away. */
export async function removeMember(input: {
  actor: AuditActor;
  projectId: string;
  userId: string;
}): Promise<RemoveResult> {
  await connectToDatabase();
  return withSession<RemoveResult>(async (session) => {
    const project = await Project.findById(input.projectId).session(session);
    if (!project) return { ok: false, reason: "project-not-found" };

    const deleted = await ProjectMember.deleteOne(
      { projectId: input.projectId, userId: input.userId },
      { session },
    );
    if (deleted.deletedCount !== 1) return { ok: false, reason: "not-a-member" };

    await recordAudit(
      {
        actor: input.actor,
        action: "project.member_removed",
        target: { type: "project", id: input.projectId },
        metadata: { code: project.code, userId: input.userId },
      },
      session,
    );
    return { ok: true };
  });
}
