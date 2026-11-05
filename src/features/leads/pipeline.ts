// The lead pipeline as a small, pure state machine (no I/O), so every rule is easy to read and to test.

export const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
};

/** Which pill colour to use for each status in the admin screens. */
export const LEAD_STATUS_TONE: Record<LeadStatus, "review" | "draft" | "live" | "archived"> = {
  new: "review",
  contacted: "draft",
  qualified: "live",
  won: "live",
  lost: "archived",
};

// Allowed moves. "won" is final. A lost lead can be reopened by contacting them again.
export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ["contacted", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["won", "lost"],
  won: [],
  lost: ["contacted"],
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

/** Old records may carry a status from before the pipeline existed ("closed"). Never show an unknown status. */
export function normalizeLeadStatus(value: unknown): LeadStatus {
  if (isLeadStatus(value)) return value;
  return value === "closed" ? "lost" : "new";
}

export type TransitionCheck =
  { ok: true } | { ok: false; reason: "invalid-transition" | "needs-organization" };

/** A lead can only be marked "won" once it is linked to a client organization (the future project's owner). */
export function validateTransition(input: {
  from: LeadStatus;
  to: LeadStatus;
  hasOrganization: boolean;
}): TransitionCheck {
  if (!LEAD_TRANSITIONS[input.from].includes(input.to)) return { ok: false, reason: "invalid-transition" };
  if (input.to === "won" && !input.hasOrganization) return { ok: false, reason: "needs-organization" };
  return { ok: true };
}

/** The moves to offer in the UI for a lead right now (includes "won" only when it would be accepted). */
export function availableTransitions(from: LeadStatus, hasOrganization: boolean): LeadStatus[] {
  return LEAD_TRANSITIONS[from].filter((to) => validateTransition({ from, to, hasOrganization }).ok);
}
