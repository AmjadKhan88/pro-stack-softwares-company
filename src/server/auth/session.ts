import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "./auth";
import { resolveAccess, type Area } from "@/server/policies/access";
import { can, isRole, type Permission, type Role } from "@/server/policies/permissions";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  /** null means the stored role is missing or unknown: such users get no access. */
  role: Role | null;
  twoFactorEnabled: boolean;
}

/** Reads the session from the request cookie. Cached per request, so calling it often is cheap. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = session.user as typeof session.user & { role?: string | null; twoFactorEnabled?: boolean | null };
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: isRole(user.role) ? user.role : null,
    twoFactorEnabled: user.twoFactorEnabled === true,
  };
});

function enforce(user: SessionUser | null, area: Area, next: string): SessionUser {
  const decision = resolveAccess(user, area);
  if (decision.type === "redirect") {
    const needsNext = decision.to === "/login" || decision.to === "/security/two-factor";
    redirect(needsNext ? `${decision.to}?next=${encodeURIComponent(next)}` : decision.to);
  }
  return user as SessionUser;
}

/** Any signed-in user. */
export async function requireUser(next = "/continue"): Promise<SessionUser> {
  return enforce(await getCurrentUser(), "account", next);
}

/** Staff only; owner/admin must also have two-factor enabled. Call this in every admin page and action. */
export async function requireStaff(next = "/admin"): Promise<SessionUser> {
  return enforce(await getCurrentUser(), "admin", next);
}

/** Client accounts only. */
export async function requireClient(next = "/portal"): Promise<SessionUser> {
  return enforce(await getCurrentUser(), "portal", next);
}

/** Staff with a specific permission; everyone else sees a 404 so protected pages are not advertised. */
export async function requirePermission(permission: Permission, next = "/admin"): Promise<SessionUser> {
  const user = await requireStaff(next);
  if (!can(user.role, permission)) notFound();
  return user;
}