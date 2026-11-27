import "server-only";
import { getClientMembership, getOrganization } from "@/features/organizations/service";
import { visibleProjectIds } from "@/features/projects/access";
import { Project } from "@/features/projects/models/project";
import { clientProjectFilter } from "@/features/projects/status";
import { connectToDatabase } from "@/server/db/mongoose";
import type { SessionUser } from "@/server/auth/session";

/**
 * Which project conversations may this person follow live? Decided here, from the database, with the same rules
 * as the pages themselves. The live service only trusts what is written in the signed ticket.
 */
export async function liveProjectsFor(user: SessionUser): Promise<string[] | "all"> {
  await connectToDatabase();

  if (user.role === "client") {
    const membership = await getClientMembership(user.id, user.email);
    const organization = membership ? await getOrganization(membership.organizationId) : null;
    if (!organization || organization.status !== "active") return [];
    const candidates = await Project.find({ organizationId: organization.id })
      .select("_id")
      .limit(200)
      .lean();
    if (candidates.length === 0) return [];
    const visible = await Project.find({
      $or: candidates.map((project) => clientProjectFilter(organization.id, String(project._id))),
    })
      .select("_id")
      .lean();
    return visible.map((project) => String(project._id));
  }

  const ids = await visibleProjectIds(user);
  return ids === null ? "all" : ids.slice(0, 200);
}
