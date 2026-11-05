export const AUDIT_ACTIONS = [
  "owner.bootstrapped",
  "invitation.created",
  "invitation.revoked",
  "invitation.accepted",
  "organization.created",
  "organization.member_added",
  "lead.status_changed",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditActor {
  id: string;
  email: string;
}
export interface AuditTarget {
  type: string;
  id: string;
}
