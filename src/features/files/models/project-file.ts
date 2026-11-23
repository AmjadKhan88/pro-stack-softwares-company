import "server-only";
import { Schema, model, models, type Model } from "mongoose";

export interface ProjectFileDoc {
  projectId: string;
  /** Copied from the project, so every client query can be limited to the client's own organization. */
  organizationId: string;
  deliverableId?: string;
  publicId: string;
  format: string;
  bytes: number;
  originalFilename: string;
  status: "active" | "archived";
  /** Hidden from clients unless staff explicitly turn this on. */
  clientVisible: boolean;
  uploadedBy: string;
  uploadedByEmail: string;
}

const projectFileSchema = new Schema<ProjectFileDoc>(
  {
    projectId: { type: String, required: true },
    organizationId: { type: String, required: true },
    deliverableId: { type: String },
    publicId: { type: String, required: true, unique: true },
    format: { type: String, required: true },
    bytes: { type: Number, required: true },
    originalFilename: { type: String, required: true, maxlength: 120 },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    clientVisible: { type: Boolean, required: true, default: false },
    uploadedBy: { type: String, required: true },
    uploadedByEmail: { type: String, required: true },
  },
  { timestamps: true },
);
projectFileSchema.index({ projectId: 1, createdAt: -1 });
projectFileSchema.index({ organizationId: 1, status: 1, clientVisible: 1, createdAt: -1 });

export const ProjectFile: Model<ProjectFileDoc> =
  (models.ProjectFile as Model<ProjectFileDoc> | undefined) ??
  model<ProjectFileDoc>("ProjectFile", projectFileSchema);
