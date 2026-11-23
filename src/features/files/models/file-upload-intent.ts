import "server-only";
import { Schema, model, models, type Model } from "mongoose";

export interface FileUploadIntentDoc {
  publicId: string;
  /** Only this person may finish this upload. */
  userId: string;
  projectId: string;
  deliverableId?: string;
  originalFilename: string;
  format: string;
  clientVisible: boolean;
  expiresAt: Date;
  consumedAt?: Date;
}

const intentSchema = new Schema<FileUploadIntentDoc>(
  {
    publicId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    projectId: { type: String, required: true },
    deliverableId: { type: String },
    originalFilename: { type: String, required: true },
    format: { type: String, required: true },
    clientVisible: { type: Boolean, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps: true },
);
// Tickets clean themselves up shortly after they expire.
intentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const FileUploadIntent: Model<FileUploadIntentDoc> =
  (models.FileUploadIntent as Model<FileUploadIntentDoc> | undefined) ??
  model<FileUploadIntentDoc>("FileUploadIntent", intentSchema);
