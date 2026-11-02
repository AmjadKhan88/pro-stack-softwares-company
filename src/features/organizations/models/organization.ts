import "server-only";
import { Schema, model, models, type Model } from "mongoose";

export interface OrganizationDoc {
  name: string;
  contactEmail?: string;
  status: "active" | "archived";
  createdBy: string;
  createdByEmail: string;
}

const organizationSchema = new Schema<OrganizationDoc>(
  {
    name: { type: String, required: true, maxlength: 120, index: true },
    contactEmail: { type: String, maxlength: 254 },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    createdBy: { type: String, required: true },
    createdByEmail: { type: String, required: true },
  },
  { timestamps: true },
);

export const Organization: Model<OrganizationDoc> =
  (models.Organization as Model<OrganizationDoc> | undefined) ??
  model<OrganizationDoc>("Organization", organizationSchema);
