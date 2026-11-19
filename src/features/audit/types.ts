export const AUDIT_ACTIONS = [
  "owner.bootstrapped",
  "invitation.created",
  "invitation.revoked",
  "invitation.accepted",
  "organization.created",
  "organization.member_added",
  "lead.status_changed",
  "proposal.created",
  "proposal.sent",
  "proposal.withdrawn",
  "proposal.reopened",
  "proposal.accepted",
  "proposal.declined",
  "project.created",
  "project.status_changed",
  "project.visibility_changed",
  "milestone.created",
  "milestone.status_changed",
  "deliverable.created",
  "deliverable.status_changed",
  "deliverable.review_submitted",
  "deliverable.review_withdrawn",
  "deliverable.review_approved",
  "deliverable.review_changes_requested",
  "project.member_assigned",
  "project.member_removed",
  "user.role_changed",
  "user.disabled",
  "user.enabled",
  "lead.created_from_portal",
  "content.created",
  "content.published",
  "content.unpublished",
  "content.archived",
  "content.unarchived",
  "content.revision_restored",
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
