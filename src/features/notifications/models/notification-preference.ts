import "server-only";
import { Schema, model, models, type Model } from "mongoose";

export interface NotificationPreferenceDoc {
  userId: string;
  /** Which kinds of notification this person wants by email. Missing means "use the default". */
  email: Record<string, boolean>;
}

const preferenceSchema = new Schema<NotificationPreferenceDoc>(
  {
    userId: { type: String, required: true, unique: true },
    email: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

export const NotificationPreference: Model<NotificationPreferenceDoc> =
  (models.NotificationPreference as Model<NotificationPreferenceDoc> | undefined) ??
  model<NotificationPreferenceDoc>("NotificationPreference", preferenceSchema);
