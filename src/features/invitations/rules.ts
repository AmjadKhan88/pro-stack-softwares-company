import { ROLES, canAssignRole, type Role } from "@/server/policies/permissions";

// Ownership is never granted by invitation (the owner is created once by the bootstrap script).
export const INVITABLE_ROLES = ROLES.filter((role) => role !== "owner") as Exclude<Role, "owner">[];
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  project_manager: "Project manager",
  developer: "Developer",
  content_manager: "Content manager",
  support: "Support",
  client: "Client",
};

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Roles this person may hand out. Admins cannot invite other admins; nobody invites an owner. */
export function invitableRolesFor(actorRole: unknown): InvitableRole[] {
  return INVITABLE_ROLES.filter((role) => canAssignRole(actorRole, role));
}

export interface InviteStatusInput {
  status: "pending" | "accepted" | "revoked";
  expiresAt: Date;
}

/** A link works only while pending and before it expires. */
export function isInviteUsable(invite: InviteStatusInput, now = new Date()): boolean {
  return invite.status === "pending" && invite.expiresAt.getTime() > now.getTime();
}

export function describeInviteState(
  invite: InviteStatusInput,
  now = new Date(),
): "pending" | "expired" | "accepted" | "revoked" {
  if (invite.status !== "pending") return invite.status;
  return invite.expiresAt.getTime() > now.getTime() ? "pending" : "expired";
}
