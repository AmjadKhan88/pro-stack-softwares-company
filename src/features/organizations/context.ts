import "server-only";
import { requireClient, type SessionUser } from "@/server/auth/session";
import { getClientMembership, getOrganization } from "./service";

export interface ClientContext {
  user: SessionUser;
  /** null when the account is not linked to an active organization (the portal then shows nothing). */
  organization: { id: string; name: string } | null;
}

/**
 * Call at the top of EVERY client portal page and action. The organization id it returns comes from the
 * signed-in account, never from the request, which is what stops one client reading another client's records.
 */
export async function requireClientContext(next = "/portal"): Promise<ClientContext> {
  const user = await requireClient(next);
  const membership = await getClientMembership(user.id, user.email);
  if (!membership) return { user, organization: null };
  const organization = await getOrganization(membership.organizationId);
  if (!organization || organization.status !== "active") return { user, organization: null };
  return { user, organization: { id: organization.id, name: organization.name } };
}
