import "server-only";
import { notFound } from "next/navigation";
import { isObjectId } from "@/lib/object-id";
import { requireStaff, type SessionUser } from "@/server/auth/session";
import { canReadProject, projectAccessScope, type ProjectScope } from "./access-rules";
import { isProjectMember, listProjectIdsForUser } from "./team-service";

/**
 * Call this at the top of EVERY admin page that shows one project's staff data.
 * It signs the person in, then allows them through only if their role may read this project
 * (everything for "all", only assigned projects for "assigned"). Otherwise it is a 404, which
 * also hides whether the project exists.
 */
export async function requireProjectAccess(
  projectId: string,
): Promise<{ user: SessionUser; scope: ProjectScope }> {
  const user = await requireStaff(`/admin/projects/${projectId}`);
  const scope = projectAccessScope(user.role);
  const isMember =
    scope === "assigned" && isObjectId(projectId) ? await isProjectMember(projectId, user.id) : false;
  if (!canReadProject({ role: user.role, isMember })) notFound();
  return { user, scope };
}

/**
 * Which projects the list should show: null means "all of them", otherwise only these ids
 * (an empty list means none). The list page must use this, never its own rule.
 */
export async function visibleProjectIds(user: SessionUser): Promise<string[] | null> {
  const scope = projectAccessScope(user.role);
  if (scope === "all") return null;
  if (scope === "assigned") return listProjectIdsForUser(user.id);
  return [];
}
