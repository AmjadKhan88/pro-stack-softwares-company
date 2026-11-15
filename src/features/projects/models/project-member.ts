import "server-only";
import { Schema, model, models, type Model } from "mongoose";

export interface ProjectMemberDoc {
  projectId: string;
  userId: string;
  assignedBy: string;
  assignedByEmail: string;
}

const projectMemberSchema = new Schema<ProjectMemberDoc>(
  {
    projectId: { type: String, required: true },
    userId: { type: String, required: true },
    assignedBy: { type: String, required: true },
    assignedByEmail: { type: String, required: true },
  },
  { timestamps: true },
);
// One membership per person per project, enforced by the database.
projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
projectMemberSchema.index({ userId: 1 });

export const ProjectMember: Model<ProjectMemberDoc> =
  (models.ProjectMember as Model<ProjectMemberDoc> | undefined) ??
  model<ProjectMemberDoc>("ProjectMember", projectMemberSchema);
