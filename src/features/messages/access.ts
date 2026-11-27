import "server-only";
import { getClientMembership, getOrganization } from "@/features/organizations/service";
import { canReadProject } from "@/features/projects/access-rules";
import { Project } from "@/features/projects/models/project";
import { clientProjectFilter } from "@/features/projects/status";
import { isProjectMember } from "@/features/projects/team-service";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";
import { resolveAccess } from "@/server/policies/access";
import type { Side } from "./rules";

export interface ConversationProject {
  id: string;
  title: string;
  organizationId: string;
  status: string;
}

export type ConversationAccess =
  | { ok: true; side: Side; user: SessionUser; project: ConversationProject }
  | { ok: false; reason: "unauthenticated" | "not-found" };

const NOT_FOUND = { ok: false, reason: "not-found" } as const;

/**
 * Decides whether the person making this request may read and write this project's conversation. Used by every
 * page and by the send action. Anything they may not use looks exactly like something that doesn't exist.
 */
export async function authorizeConversation(projectId: string): Promise<ConversationAccess> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  if (!isObjectId(projectId)) return NOT_FOUND;
  await connectToDatabase();

  if (user.role === "client") {
    if (resolveAccess(user, "portal").type !== "allow") return NOT_FOUND;
    // The organization comes from the signed-in account, never from the request.
    const membership = await getClientMembership(user.id, user.email);
    const organization = membership ? await getOrganization(membership.organizationId) : null;
    if (!organization || organization.status !== "active") return NOT_FOUND;
    const project = await Project.findOne(clientProjectFilter(organization.id, projectId)).lean();
    if (!project) return NOT_FOUND;
    return {
      ok: true,
      side: "client",
      user,
      project: {
        id: String(project._id),
        title: project.title,
        organizationId: project.organizationId,
        status: project.status,
      },
    };
  }

  if (resolveAccess(user, "admin").type !== "allow") return NOT_FOUND;
  const project = await Project.findById(projectId).lean();
  if (!project) return NOT_FOUND;
  const isMember = await isProjectMember(projectId, user.id);
  if (!canReadProject({ role: user.role, isMember })) return NOT_FOUND;
  return {
    ok: true,
    side: "staff",
    user,
    project: {
      id: String(project._id),
      title: project.title,
      organizationId: project.organizationId,
      status: project.status,
    },
  };
}
