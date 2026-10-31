export const AUDIT_ACTIONS = [
  "owner.bootstrapped",
  "invitation.created",
  "invitation.revoked",
  "invitation.accepted",
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
