import "server-only";
import { Schema, model, models, type Model } from "mongoose";

export interface OrganizationMemberDoc {
  organizationId: string;
  userId: string;
  role: "member";
}

// `userId` is unique: in this phase a client account belongs to exactly ONE organization.
// That single fact is what lets every client query be scoped to one organization id.
const organizationMemberSchema = new Schema<OrganizationMemberDoc>(
  {
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, unique: true },
    role: { type: String, enum: ["member"], default: "member" },
  },
  { timestamps: true },
);

export const OrganizationMember: Model<OrganizationMemberDoc> =
  (models.OrganizationMember as Model<OrganizationMemberDoc> | undefined) ??
  model<OrganizationMemberDoc>("OrganizationMember", organizationMemberSchema);
