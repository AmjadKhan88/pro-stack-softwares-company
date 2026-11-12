// The proposal lifecycle as a small, pure state machine (no I/O).

export const PROPOSAL_STATUSES = ["draft", "sent", "accepted", "declined", "withdrawn"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** What a person sees: a sent proposal past its expiry date is shown as "expired". */
export type DisplayStatus = ProposalStatus | "expired";

export const PROPOSAL_STATUS_LABELS: Record<DisplayStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export const PROPOSAL_STATUS_TONE: Record<
  DisplayStatus,
  "draft" | "review" | "live" | "blocked" | "archived"
> = {
  draft: "draft",
  sent: "review",
  accepted: "live",
  declined: "blocked",
  withdrawn: "archived",
  expired: "archived",
};

export const PROPOSAL_VALIDITY_DAYS = 30;

export type Mover = "staff" | "client";

// Who may make which move. Staff write and send; only the client accepts or declines. Accepted is final.
const MOVES: Record<Mover, Record<ProposalStatus, readonly ProposalStatus[]>> = {
  staff: { draft: ["sent"], sent: ["withdrawn"], accepted: [], declined: ["draft"], withdrawn: ["draft"] },
  client: { draft: [], sent: ["accepted", "declined"], accepted: [], declined: [], withdrawn: [] },
};

export function isProposalStatus(value: unknown): value is ProposalStatus {
  return typeof value === "string" && (PROPOSAL_STATUSES as readonly string[]).includes(value);
}

export function canMove(from: ProposalStatus, to: ProposalStatus, by: Mover): boolean {
  return MOVES[by][from].includes(to);
}

export function staffMovesFrom(from: ProposalStatus): readonly ProposalStatus[] {
  return MOVES.staff[from];
}

/** Content can only change while it is a draft. Once sent, the client sees exactly what was sent. */
export function isEditable(status: ProposalStatus): boolean {
  return status === "draft";
}

export function expiryFrom(sentAt: Date): Date {
  return new Date(sentAt.getTime() + PROPOSAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

interface Expirable {
  status: ProposalStatus;
  expiresAt?: Date | null;
}

export function displayStatus(proposal: Expirable, now = new Date()): DisplayStatus {
  if (proposal.status === "sent" && proposal.expiresAt && proposal.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return proposal.status;
}

/** A client may answer only while the proposal is sent and has not expired. */
export function canRespond(proposal: Expirable, now = new Date()): boolean {
  return displayStatus(proposal, now) === "sent";
}

/** Clients never see drafts or withdrawn proposals. */
export const CLIENT_VISIBLE_STATUSES = ["sent", "accepted", "declined"] as const;

/**
 * The ONLY filter client code may use to read proposals. It is always scoped to the client's own
 * organization (taken from their signed-in account) and hides drafts and withdrawn proposals.
 */
export function clientProposalFilter(organizationId: string, proposalId?: string) {
  if (!organizationId) throw new Error("A client proposal query needs an organization id.");
  return {
    organizationId,
    status: { $in: [...CLIENT_VISIBLE_STATUSES] },
    ...(proposalId ? { _id: proposalId } : {}),
  };
}
