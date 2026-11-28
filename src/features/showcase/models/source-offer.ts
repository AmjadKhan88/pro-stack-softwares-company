import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { OFFER_STATUSES, type OfferStatus } from "../rules";

export interface SourceOfferDoc {
  slug: string;
  title: string;
  summary: string;
  description?: string;
  techStack: string[];
  liveUrl?: string;
  caseStudySlug?: string;
  priceMinor: number;
  status: OfferStatus;
  sortOrder: number;
  createdBy: string;
}

const offerSchema = new Schema<SourceOfferDoc>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true, maxlength: 100 },
    summary: { type: String, required: true, maxlength: 300 },
    description: { type: String, maxlength: 5000 },
    techStack: { type: [String], default: [] },
    liveUrl: { type: String, maxlength: 300 },
    caseStudySlug: { type: String, maxlength: 60 },
    priceMinor: { type: Number, required: true, min: 100 },
    status: { type: String, enum: [...OFFER_STATUSES], default: "draft" },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);
offerSchema.index({ status: 1, sortOrder: 1 });

export const SourceOffer: Model<SourceOfferDoc> =
  (models.SourceOffer as Model<SourceOfferDoc> | undefined) ??
  model<SourceOfferDoc>("SourceOffer", offerSchema);
