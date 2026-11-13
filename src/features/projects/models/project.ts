import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { PROJECT_STATUSES, type ProjectStatus } from "../status";

export interface ProjectDoc {
  code: string;
  /** The client organization that owns this project. Every client query is scoped to it. */
  organizationId: string;
  leadId: string;
  /** One project per proposal: this is unique, so a proposal can only ever be converted once. */
  proposalId: string;
  title: string;
  summary: string;
  status: ProjectStatus;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdByEmail: string;
}

const projectSchema = new Schema<ProjectDoc>(
  {
    code: { type: String, required: true, unique: true },
    organizationId: { type: String, required: true },
    leadId: { type: String, required: true },
    proposalId: { type: String, required: true, unique: true },
    title: { type: String, required: true, maxlength: 160 },
    summary: { type: String, required: true, maxlength: 600 },
    status: { type: String, enum: [...PROJECT_STATUSES], default: "planning" },
    startedAt: { type: Date },
    completedAt: { type: Date },
    createdBy: { type: String, required: true },
    createdByEmail: { type: String, required: true },
  },
  { timestamps: true },
);
projectSchema.index({ organizationId: 1, updatedAt: -1 });

export const Project: Model<ProjectDoc> =
  (models.Project as Model<ProjectDoc> | undefined) ?? model<ProjectDoc>("Project", projectSchema);
