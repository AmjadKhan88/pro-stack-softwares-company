import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { INVITABLE_ROLES, type InvitableRole } from "../rules";

export interface InvitationDoc {
  email: string;
  role: InvitableRole;
  tokenHash: string;
  status: "pending" | "accepted" | "revoked";
  invitedBy: string;
  invitedByEmail: string;
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
}

const invitationSchema = new Schema<InvitationDoc>(
  {
    email: { type: String, required: true, lowercase: true, maxlength: 254, index: true },
    role: { type: String, enum: [...INVITABLE_ROLES], required: true },
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending", index: true },
    invitedBy: { type: String, required: true },
    invitedByEmail: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

export const Invitation: Model<InvitationDoc> =
  (models.Invitation as Model<InvitationDoc> | undefined) ??
  model<InvitationDoc>("Invitation", invitationSchema);
