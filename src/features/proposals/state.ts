import type { ProposalField } from "./schema";

export type ProposalFormValues = Partial<Record<ProposalField | "leadId" | "proposalId", string>>;

export type ProposalFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<ProposalField, string>>;
      values?: ProposalFormValues;
    };

export type ProposalActionState =
  { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

export type ProposalResponseState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: { authorized?: string; reason?: string } };

export const initialProposalFormState: ProposalFormState = { status: "idle" };
export const initialProposalActionState: ProposalActionState = { status: "idle" };
export const initialProposalResponseState: ProposalResponseState = { status: "idle" };
