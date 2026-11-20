import "server-only";
import { Schema, model, models, type Model } from "mongoose";

export interface MediaUploadIntentDoc {
  publicId: string;
  /** Only this person may finish this upload. */
  userId: string;
  altText: string;
  originalFilename: string;
  expiresAt: Date;
  consumedAt?: Date;
}

const intentSchema = new Schema<MediaUploadIntentDoc>(
  {
    publicId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    altText: { type: String, required: true },
    originalFilename: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps: true },
);
// Tickets clean themselves up shortly after they expire.
intentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const MediaUploadIntent: Model<MediaUploadIntentDoc> =
  (models.MediaUploadIntent as Model<MediaUploadIntentDoc> | undefined) ??
  model<MediaUploadIntentDoc>("MediaUploadIntent", intentSchema);
