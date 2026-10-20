import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { BUDGET_RANGES, PROJECT_TYPES, TIMEFRAMES } from "../schema";

export interface LeadDoc {
  referenceCode: string;
  name: string;
  email: string;
  company?: string;
  projectType: (typeof PROJECT_TYPES)[number];
  budgetRange?: (typeof BUDGET_RANGES)[number];
  timeframe?: (typeof TIMEFRAMES)[number];
  message: string;
  status: "new" | "contacted" | "qualified" | "closed";
  source: string;
  ipHash?: string;
  archivedAt?: Date;
}

const leadSchema = new Schema<LeadDoc>(
  {
    referenceCode: { type: String, required: true, unique: true },
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, maxlength: 254, index: true },
    company: { type: String, maxlength: 120 },
    projectType: { type: String, enum: [...PROJECT_TYPES], required: true },
    budgetRange: { type: String, enum: [...BUDGET_RANGES] },
    timeframe: { type: String, enum: [...TIMEFRAMES] },
    message: { type: String, required: true, maxlength: 4000 },
    status: { type: String, enum: ["new", "contacted", "qualified", "closed"], default: "new", index: true },
    source: { type: String, required: true },
    ipHash: { type: String },
    archivedAt: { type: Date },
  },
  { timestamps: true },
);
leadSchema.index({ createdAt: -1 });

export const Lead: Model<LeadDoc> =
  (models.Lead as Model<LeadDoc> | undefined) ?? model<LeadDoc>("Lead", leadSchema);