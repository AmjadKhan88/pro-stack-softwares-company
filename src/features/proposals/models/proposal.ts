import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { CURRENCIES, type Currency } from "../money";
import { PROPOSAL_STATUSES, type ProposalStatus } from "../status";

export interface Responder {
  userId: string;
  email: string;
  name: string;
}

export interface ProposalDoc {
  code: string;
  leadId: string;
  /** The client organization this proposal belongs to. Every client query is scoped to it. */
  organizationId: string;
  title: string;
  summary: string;
  scope: string;
  deliverables: string[];
  assumptions: string[];
  exclusions: string[];
  timelineSummary: string;
  estimatedWeeks: number;
  currency: Currency;
  /** Whole minor units (cents/paisa), never a floating-point number. */
  totalMinor: number;
  paymentTerms: string;
  status: ProposalStatus;
  sentAt?: Date;
  expiresAt?: Date;
  acceptedAt?: Date;
  acceptedBy?: Responder;
  declinedAt?: Date;
  declinedBy?: Responder;
  declineReason?: string;
  /** Set once when the accepted proposal is converted. Unique, so it can only be converted once. */
  projectId?: string;
  createdBy: string;
  createdByEmail: string;
}

const responderSchema = new Schema<Responder>(
  {
    userId: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false },
);

const proposalSchema = new Schema<ProposalDoc>(
  {
    code: { type: String, required: true, unique: true },
    leadId: { type: String, required: true },
    organizationId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 160 },
    summary: { type: String, required: true, maxlength: 600 },
    scope: { type: String, required: true, maxlength: 8000 },
    deliverables: { type: [String], default: [] },
    assumptions: { type: [String], default: [] },
    exclusions: { type: [String], default: [] },
    timelineSummary: { type: String, required: true, maxlength: 1000 },
    estimatedWeeks: { type: Number, required: true, min: 1, max: 104 },
    currency: { type: String, enum: [...CURRENCIES], required: true },
    totalMinor: { type: Number, required: true, min: 1 },
    paymentTerms: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: [...PROPOSAL_STATUSES], default: "draft" },
    sentAt: { type: Date },
    expiresAt: { type: Date },
    acceptedAt: { type: Date },
    acceptedBy: { type: responderSchema },
    declinedAt: { type: Date },
    declinedBy: { type: responderSchema },
    declineReason: { type: String, maxlength: 1000 },
    projectId: { type: String, index: { unique: true, sparse: true } },
    createdBy: { type: String, required: true },
    createdByEmail: { type: String, required: true },
  },
  { timestamps: true },
);
proposalSchema.index({ leadId: 1, status: 1 });
proposalSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });

export const Proposal: Model<ProposalDoc> =
  (models.Proposal as Model<ProposalDoc> | undefined) ?? model<ProposalDoc>("Proposal", proposalSchema);
