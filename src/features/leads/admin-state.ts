export type LeadActionState =
  { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

export const initialLeadActionState: LeadActionState = { status: "idle" };
