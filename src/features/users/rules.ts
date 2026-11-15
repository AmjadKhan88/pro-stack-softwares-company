import { isAssignableRole } from "@/features/projects/access-rules";
import { can, canAssignRole, isRole, type Role } from "@/server/policies/permissions";

// Who may change whose role or status. Pure (no I/O) so every rule is easy to read and to test.

// Roles that can be handed out on the user screens. "owner" is never granted here and "client" is locked.
export const ROLE_CHANGE_OPTIONS = [
  "admin",
  "project_manager",
  "developer",
  "content_manager",
  "support",
] as const;
export type RoleChangeOption = (typeof ROLE_CHANGE_OPTIONS)[number];

export type Denial =
  | "no-permission"
  | "self"
  | "invalid-role"
  | "same-role"
  | "owner-not-grantable"
  | "client-role-locked"
  | "owner-protected"
  | "last-owner"
  | "admin-protected"
  | "role-not-allowed";

export const DENIAL_MESSAGES: Record<Denial, string> = {
  "no-permission": "You don't have permission to manage accounts.",
  self: "You can't change your own role or status. Ask another administrator.",
  "invalid-role": "Choose a valid role.",
  "same-role": "That is already their role.",
  "owner-not-grantable": "Ownership can't be granted here.",
  "client-role-locked":
    "Client accounts can't be switched to or from a staff role. Invite the person again with the right role.",
  "owner-protected": "Only another owner can change an owner account.",
  "last-owner": "This is the only owner, so it can't be changed. There must always be an owner.",
  "admin-protected": "Only the owner can change an admin account.",
  "role-not-allowed": "Only the owner can grant that role.",
};

export type Check = { ok: true } | { ok: false; reason: Denial };

export interface AccountContext {
  actorId: string;
  actorRole: unknown;
  targetId: string;
  targetRole: unknown;
  /** Active (not disabled) owners. */
  ownerCount: number;
}

/** Owners are protected: admins can never touch them, and the last active owner can't be touched by anyone. */
function ownerTargetDenial(actorRole: unknown, targetRole: unknown, ownerCount: number): Denial | null {
  if (targetRole !== "owner") return null;
  if (actorRole !== "owner") return "owner-protected";
  if (ownerCount <= 1) return "last-owner";
  return null;
}

export function checkRoleChange(input: AccountContext & { newRole: unknown }): Check {
  if (!can(input.actorRole, "users.manage")) return { ok: false, reason: "no-permission" };
  if (input.actorId === input.targetId) return { ok: false, reason: "self" };
  if (!isRole(input.newRole)) return { ok: false, reason: "invalid-role" };
  if (input.newRole === input.targetRole) return { ok: false, reason: "same-role" };
  if (input.newRole === "owner") return { ok: false, reason: "owner-not-grantable" };
  if (input.targetRole === "client" || input.newRole === "client")
    return { ok: false, reason: "client-role-locked" };

  const ownerDenial = ownerTargetDenial(input.actorRole, input.targetRole, input.ownerCount);
  if (ownerDenial) return { ok: false, reason: ownerDenial };

  if (input.actorRole === "admin") {
    if (input.targetRole === "admin") return { ok: false, reason: "admin-protected" };
    if (!canAssignRole("admin", input.newRole)) return { ok: false, reason: "role-not-allowed" };
  }
  return { ok: true };
}

/** Disabling and re-enabling follow the same protections as role changes. */
export function checkDisable(input: AccountContext): Check {
  if (!can(input.actorRole, "users.manage")) return { ok: false, reason: "no-permission" };
  if (input.actorId === input.targetId) return { ok: false, reason: "self" };
  const ownerDenial = ownerTargetDenial(input.actorRole, input.targetRole, input.ownerCount);
  if (ownerDenial) return { ok: false, reason: ownerDenial };
  if (input.actorRole === "admin" && input.targetRole === "admin")
    return { ok: false, reason: "admin-protected" };
  return { ok: true };
}

/** The roles this person may give to this account right now (used to fill the dropdown). */
export function allowedRoleOptions(context: AccountContext): RoleChangeOption[] {
  return ROLE_CHANGE_OPTIONS.filter((role) => checkRoleChange({ ...context, newRole: role }).ok);
}

/** Why the role can't be changed at all, or null if at least one role is available. */
export function explainRoleChange(context: AccountContext): string | null {
  if (allowedRoleOptions(context).length > 0) return null;
  // Probe with a real role that differs from the current one, so the reason is the real blocker.
  const probe: Role = context.targetRole === "support" ? "developer" : "support";
  const check = checkRoleChange({ ...context, newRole: probe });
  return check.ok ? null : DENIAL_MESSAGES[check.reason];
}

/** Moving to a role that can't be on project teams ends the person's team memberships. */
export function endsProjectAssignments(newRole: unknown): boolean {
  return !isAssignableRole(newRole);
}
