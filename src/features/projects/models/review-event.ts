import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import type { ReviewEventType } from "../review";

export interface ReviewEventDoc {
  deliverableId: string;
  projectId: string;
  round: number;
  type: ReviewEventType;
  message?: string;
  actorId: string;
  actorName: string;
  actorType: "staff" | "client";
}

const reviewEventSchema = new Schema<ReviewEventDoc>(
  {
    deliverableId: { type: String, required: true },
    projectId: { type: String, required: true },
    round: { type: Number, required: true },
    type: { type: String, enum: ["submitted", "withdrawn", "approved", "changes_requested"], required: true },
    message: { type: String, maxlength: 2000 },
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    actorType: { type: String, enum: ["staff", "client"], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
reviewEventSchema.index({ deliverableId: 1, createdAt: 1 });
reviewEventSchema.index({ projectId: 1, createdAt: 1 });

export const ReviewEvent: Model<ReviewEventDoc> =
  (models.ReviewEvent as Model<ReviewEventDoc> | undefined) ??
  model<ReviewEventDoc>("ReviewEvent", reviewEventSchema);
