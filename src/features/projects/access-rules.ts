import { can, isRole } from "@/server/policies/permissions";

// Who may read which project. Pure (no I/O) so the rule is easy to read and to test.

export type ProjectScope = "all" | "assigned" | "none";

/** "all" sees every project, "assigned" only those they are a team member of, "none" nothing. */
export function projectAccessScope(role: unknown): ProjectScope {
  if (!isRole(role)) return "none";
  if (can(role, "projects.read.all")) return "all";
  if (can(role, "projects.read.assigned")) return "assigned";
  return "none";
}

/** The decision itself. Being assigned only matters for roles whose scope is "assigned". */
export function canReadProject(input: { role: unknown; isMember: boolean }): boolean {
  const scope = projectAccessScope(input.role);
  return scope === "all" || (scope === "assigned" && input.isMember);
}

// People who work on delivery. Admins and the owner already see everything, so they are not "assigned".
export const ASSIGNABLE_ROLES = ["project_manager", "developer", "support"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}
