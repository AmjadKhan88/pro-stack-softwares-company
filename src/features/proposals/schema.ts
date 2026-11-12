import { z } from "zod";
import { isObjectId } from "@/lib/object-id";
import { CURRENCIES, parseMoneyToMinor } from "./money";

export { pickFields } from "@/lib/form-fields";

/** One item per line. Blank lines are dropped and leading bullet marks ("- ", "* ", "• ") are removed. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*•]\s+/, "")
        .trim(),
    )
    .filter((line) => line.length > 0);
}

function linesField(options: { noun: string; min: number; max: number; maxLength: number }) {
  return z.preprocess(
    (value) => (typeof value === "string" ? splitLines(value) : []),
    z
      .array(
        z.string().max(options.maxLength, `Keep each ${options.noun} under ${options.maxLength} characters.`),
      )
      .min(options.min, `Add at least ${options.min} ${options.noun}.`)
      .max(options.max, `Use at most ${options.max} ${options.noun}s.`),
  );
}

const weeks = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : undefined),
  z
    .number({ error: "Enter the estimated duration in weeks." })
    .int("Use a whole number of weeks.")
    .min(1, "At least 1 week.")
    .max(104, "At most 104 weeks."),
);

const amount = z
  .string({ error: "Enter the total price." })
  .trim()
  .transform((value, ctx) => {
    const minor = parseMoneyToMinor(value);
    if (minor === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount, for example 1500 or 1,500.50." });
      return z.NEVER;
    }
    return minor;
  });

/** What staff type into the proposal form. `totalAmount` comes out as whole minor units (cents/paisa). */
export const proposalInputSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(3, "Give the proposal a title.")
    .max(160, "Keep the title under 160 characters."),
  summary: z
    .string()
    .trim()
    .min(10, "Write a short summary.")
    .max(600, "Keep the summary under 600 characters."),
  scope: z
    .string()
    .trim()
    .min(30, "Describe the scope in a little more detail.")
    .max(8000, "Keep the scope under 8,000 characters."),
  deliverables: linesField({ noun: "deliverable", min: 1, max: 20, maxLength: 200 }),
  assumptions: linesField({ noun: "assumption", min: 0, max: 15, maxLength: 300 }),
  exclusions: linesField({ noun: "exclusion", min: 0, max: 15, maxLength: 300 }),
  timelineSummary: z
    .string()
    .trim()
    .min(10, "Describe the timeline.")
    .max(1000, "Keep the timeline under 1,000 characters."),
  estimatedWeeks: weeks,
  currency: z.enum(CURRENCIES, { error: "Choose a currency." }),
  totalAmount: amount,
  paymentTerms: z
    .string()
    .trim()
    .min(5, "Describe the payment terms.")
    .max(1000, "Keep the payment terms under 1,000 characters."),
});

export type ProposalInput = z.infer<typeof proposalInputSchema>;
export type ProposalField = keyof ProposalInput;

export const PROPOSAL_FIELDS = [
  "title",
  "summary",
  "scope",
  "deliverables",
  "assumptions",
  "exclusions",
  "timelineSummary",
  "estimatedWeeks",
  "currency",
  "totalAmount",
  "paymentTerms",
] as const;

const objectId = z.string().refine(isObjectId, "Invalid proposal.");

export const createProposalSchema = z.strictObject({
  leadId: z.string().refine(isObjectId, "Invalid lead."),
});
export const proposalIdSchema = z.strictObject({ proposalId: objectId });
export const staffTransitionSchema = z.strictObject({
  proposalId: objectId,
  to: z.enum(["sent", "withdrawn", "draft"], { error: "Choose an action." }),
});

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** A client's answer. Accepting needs an explicit "I am authorized" confirmation. */
export const respondSchema = z
  .strictObject({
    proposalId: objectId,
    decision: z.enum(["accept", "decline"], { error: "Choose accept or decline." }),
    authorized: z.preprocess(emptyToUndefined, z.literal("on").optional()),
    reason: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(1000, "Keep the reason under 1,000 characters.").optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "accept" && data.authorized !== "on") {
      ctx.addIssue({
        code: "custom",
        path: ["authorized"],
        message: "Please confirm you are authorized to accept this proposal for your organization.",
      });
    }
  });

export const CREATE_FIELDS = ["leadId", ...PROPOSAL_FIELDS] as const;
export const UPDATE_FIELDS = ["proposalId", ...PROPOSAL_FIELDS] as const;
export const PROPOSAL_ID_FIELDS = ["proposalId"] as const;
export const TRANSITION_FIELDS = ["proposalId", "to"] as const;
export const RESPOND_FIELDS = ["proposalId", "decision", "authorized", "reason"] as const;
