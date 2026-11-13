import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { MILESTONE_STATUSES, type MilestoneStatus } from "../status";

export interface MilestoneDoc {
  projectId: string;
  title: string;
  description?: string;
  dueDate?: Date;
  status: MilestoneStatus;
  position: number;
  /** Hidden from clients unless staff explicitly turn this on. */
  clientVisible: boolean;
  createdBy: string;
}

const milestoneSchema = new Schema<MilestoneDoc>(
  {
    projectId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 160 },
    description: { type: String, maxlength: 1000 },
    dueDate: { type: Date },
    status: { type: String, enum: [...MILESTONE_STATUSES], default: "planned" },
    position: { type: Number, required: true, default: 0 },
    clientVisible: { type: Boolean, required: true, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);
milestoneSchema.index({ projectId: 1, position: 1 });
milestoneSchema.index({ projectId: 1, clientVisible: 1 });

export const Milestone: Model<MilestoneDoc> =
  (models.Milestone as Model<MilestoneDoc> | undefined) ?? model<MilestoneDoc>("Milestone", milestoneSchema);
