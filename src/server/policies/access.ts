import { can, isRole, isStaffRole, requiresTwoFactor } from "./permissions";

// Pure access decisions (no I/O), used by the server session helpers and unit-tested.

export type Area = "admin" | "portal" | "account";
export interface AccessUser {
  role: unknown;
  twoFactorEnabled: boolean;
}
export type AccessDecision = { type: "allow" } | { type: "redirect"; to: string };

const allow: AccessDecision = { type: "allow" };
const redirectTo = (to: string): AccessDecision => ({ type: "redirect", to });

/** Where a signed-in user belongs by default. */
export function homeFor(role: unknown): string {
  if (isStaffRole(role)) return "/admin";
  if (role === "client") return "/portal";
  return "/no-access";
}

export function resolveAccess(user: AccessUser | null, area: Area): AccessDecision {
  if (!user) return redirectTo("/login");
  if (area === "account") return allow; // any signed-in user may manage their own security
  if (!isRole(user.role)) return redirectTo("/no-access");

  if (area === "portal") {
    return can(user.role, "portal.access") ? allow : redirectTo(homeFor(user.role));
  }

  if (!can(user.role, "admin.access")) return redirectTo(homeFor(user.role));
  if (requiresTwoFactor(user.role) && !user.twoFactorEnabled) return redirectTo("/security/two-factor");
  return allow;
}

/** Better Auth admin endpoints must not work for an owner/admin session that has not enabled two-factor. */
export function isTwoFactorBlocked(user: AccessUser | null, path: string): boolean {
  if (!user || !path.startsWith("/admin/")) return false;
  return requiresTwoFactor(user.role) && !user.twoFactorEnabled;
}
