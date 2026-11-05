import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { LEAD_STATUSES, type LeadStatus } from "../pipeline";

export interface LeadActivityDoc {
  leadId: string;
  type: "note" | "status_change" | "organization_linked";
  body?: string;
  fromStatus?: LeadStatus;
  toStatus?: LeadStatus;
  actorId: string;
  actorEmail: string;
}

const leadActivitySchema = new Schema<LeadActivityDoc>(
  {
    leadId: { type: String, required: true },
    type: { type: String, enum: ["note", "status_change", "organization_linked"], required: true },
    body: { type: String, maxlength: 2000 },
    fromStatus: { type: String, enum: [...LEAD_STATUSES] },
    toStatus: { type: String, enum: [...LEAD_STATUSES] },
    actorId: { type: String, required: true },
    actorEmail: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
leadActivitySchema.index({ leadId: 1, createdAt: -1 });

export const LeadActivity: Model<LeadActivityDoc> =
  (models.LeadActivity as Model<LeadActivityDoc> | undefined) ??
  model<LeadActivityDoc>("LeadActivity", leadActivitySchema);
