// Pure module (no I/O) so the access rules are easy to read and to test.
// Default is DENY: anything not listed here is not allowed.

export const ROLES = [
  "owner",
  "admin",
  "project_manager",
  "developer",
  "content_manager",
  "support",
  "client",
] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = [
  "owner",
  "admin",
  "project_manager",
  "developer",
  "content_manager",
  "support",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  "admin.access",
  "portal.access",
  "leads.read",
  "leads.manage",
  "clients.manage",
  "proposals.manage",
  "projects.read.all",
  "projects.read.assigned",
  "projects.manage",
  "content.edit",
  "content.publish",
  "users.manage",
  "settings.manage",
  "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const grants: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS.filter((p) => p !== "portal.access"),
  admin: PERMISSIONS.filter((p) => p !== "portal.access"),
  project_manager: [
    "admin.access",
    "leads.read",
    "leads.manage",
    "clients.manage",
    "proposals.manage",
    "projects.read.all",
    "projects.manage",
  ],
  developer: ["admin.access", "projects.read.assigned"],
  content_manager: ["admin.access", "content.edit", "content.publish"],
  support: ["admin.access", "leads.read", "leads.manage", "projects.read.all"],
  // Clients only reach the portal, and only their own organisation's records (ownership is checked per query).
  client: ["portal.access"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

/** Unknown, missing or multi-valued roles get no permissions. */
export function can(role: unknown, permission: Permission): boolean {
  return isRole(role) && grants[role].includes(permission);
}

/** Owner and admin accounts must use two-factor sign-in. */
export function requiresTwoFactor(role: unknown): boolean {
  return role === "owner" || role === "admin";
}

/** Who may give which role. Admins cannot create other admins or owners. */
export function canAssignRole(actorRole: unknown, targetRole: unknown): boolean {
  if (!isRole(targetRole)) return false;
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole !== "owner" && targetRole !== "admin";
  return false;
}
