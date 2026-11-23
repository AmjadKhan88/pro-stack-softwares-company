import "server-only";
import { getClientMembership, getOrganization } from "@/features/organizations/service";
import { projectAccessScope } from "@/features/projects/access-rules";
import { isProjectMember } from "@/features/projects/team-service";
import { getCurrentUser } from "@/server/auth/session";
import { resolveAccess } from "@/server/policies/access";
import { clientMayDownload, staffMayDownload } from "./rules";
import { loadFileForDownload, type FileForDownload } from "./service";

export type DownloadDecision =
  | { ok: true; file: FileForDownload; userId: string }
  | { ok: false; reason: "unauthenticated" | "not-found" };

const NOT_FOUND = { ok: false, reason: "not-found" } as const;

/**
 * Decides whether the person making this request may download this file. Used by the download address on EVERY
 * request. A file the person may not have looks exactly like a file that doesn't exist.
 */
export async function authorizeFileDownload(fileId: string): Promise<DownloadDecision> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const file = await loadFileForDownload(fileId);
  if (!file) return NOT_FOUND;

  if (user.role === "client") {
    if (resolveAccess(user, "portal").type !== "allow") return NOT_FOUND;
    // The organization comes from the signed-in account, never from the request.
    const membership = await getClientMembership(user.id, user.email);
    const organization = membership ? await getOrganization(membership.organizationId) : null;
    const organizationId = organization && organization.status === "active" ? organization.id : null;
    const allowed = clientMayDownload({
      clientOrganizationId: organizationId,
      fileOrganizationId: file.organizationId,
      fileStatus: file.status,
      fileClientVisible: file.clientVisible,
      hasDeliverable: file.deliverableId !== null,
      deliverableClientVisible: file.deliverableClientVisible === true,
    });
    return allowed ? { ok: true, file, userId: user.id } : NOT_FOUND;
  }

  if (resolveAccess(user, "admin").type !== "allow") return NOT_FOUND;
  const scope = projectAccessScope(user.role);
  const isMember = scope === "assigned" ? await isProjectMember(file.projectId, user.id) : false;
  return staffMayDownload({ role: user.role, isMember }) ? { ok: true, file, userId: user.id } : NOT_FOUND;
}
