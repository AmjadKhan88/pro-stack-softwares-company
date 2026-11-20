import "server-only";
import { Schema, model, models, type Model } from "mongoose";

export interface MediaAssetDoc {
  publicId: string;
  secureUrl: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  altText: string;
  originalFilename: string;
  status: "active" | "archived";
  uploadedBy: string;
  uploadedByEmail: string;
}

const mediaAssetSchema = new Schema<MediaAssetDoc>(
  {
    publicId: { type: String, required: true, unique: true },
    secureUrl: { type: String, required: true },
    format: { type: String, required: true },
    bytes: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    altText: { type: String, required: true, maxlength: 200 },
    originalFilename: { type: String, required: true, maxlength: 120 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    uploadedBy: { type: String, required: true },
    uploadedByEmail: { type: String, required: true },
  },
  { timestamps: true },
);
mediaAssetSchema.index({ status: 1, createdAt: -1 });

export const MediaAsset: Model<MediaAssetDoc> =
  (models.MediaAsset as Model<MediaAssetDoc> | undefined) ??
  model<MediaAssetDoc>("MediaAsset", mediaAssetSchema);
