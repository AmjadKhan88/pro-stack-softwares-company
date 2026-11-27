import "server-only";
import { Schema, model, models, type Model } from "mongoose";

export interface MessageDoc {
  projectId: string;
  /** Copied from the project, so every client query can be limited to the client's own organization. */
  organizationId: string;
  authorId: string;
  authorName: string;
  authorType: "client" | "staff";
  body: string;
}

const messageSchema = new Schema<MessageDoc>(
  {
    projectId: { type: String, required: true },
    organizationId: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true, maxlength: 100 },
    authorType: { type: String, enum: ["client", "staff"], required: true },
    body: { type: String, required: true, maxlength: 4000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
messageSchema.index({ projectId: 1, createdAt: -1 });
messageSchema.index({ organizationId: 1 });

export const Message: Model<MessageDoc> =
  (models.Message as Model<MessageDoc> | undefined) ?? model<MessageDoc>("Message", messageSchema);
