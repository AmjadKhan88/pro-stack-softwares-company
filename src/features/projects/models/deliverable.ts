import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { REVIEW_STATES, type ReviewState } from "../review";
import { DELIVERABLE_STATUSES, type DeliverableStatus } from "../status";

export interface DeliverableDoc {
  projectId: string;
  milestoneId?: string;
  title: string;
  description?: string;
  status: DeliverableStatus;
  position: number;
  /** Hidden from clients unless staff explicitly turn this on. */
  clientVisible: boolean;
  /** Missing on deliverables created before reviews existed; read it with normalizeReviewState(). */
  reviewStatus?: ReviewState | null;
  /** How many times it has been submitted for review. */
  reviewRound?: number;
  createdBy: string;
}

const deliverableSchema = new Schema<DeliverableDoc>(
  {
    projectId: { type: String, required: true },
    milestoneId: { type: String },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    status: { type: String, enum: [...DELIVERABLE_STATUSES], default: "planned" },
    position: { type: Number, required: true, default: 0 },
    clientVisible: { type: Boolean, required: true, default: false },
    reviewStatus: { type: String, enum: [...REVIEW_STATES], default: "not_submitted" },
    reviewRound: { type: Number, default: 0 },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);
deliverableSchema.index({ projectId: 1, position: 1 });
deliverableSchema.index({ projectId: 1, clientVisible: 1 });

export const Deliverable: Model<DeliverableDoc> =
  (models.Deliverable as Model<DeliverableDoc> | undefined) ??
  model<DeliverableDoc>("Deliverable", deliverableSchema);
