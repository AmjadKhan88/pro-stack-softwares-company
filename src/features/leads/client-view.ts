import { normalizeLeadStatus } from "./pipeline";

/**
 * What a client sees about their request. It deliberately hides the internal pipeline
 * (new / contacted / qualified / won / lost) behind simple wording.
 */
export const CLIENT_REQUEST_STATUS = {
  new: { label: "Received", tone: "review", note: "We've received your request and will review it shortly." },
  contacted: { label: "In review", tone: "review", note: "We're looking at your request." },
  qualified: { label: "In review", tone: "review", note: "We're preparing the next steps." },
  won: { label: "Accepted", tone: "live", note: "Your project is under way. See Projects." },
  lost: {
    label: "Closed",
    tone: "archived",
    note: "This request was closed. Contact us if you'd like to revisit it.",
  },
} as const;

export function clientRequestStatus(status: unknown) {
  return CLIENT_REQUEST_STATUS[normalizeLeadStatus(status)];
}
