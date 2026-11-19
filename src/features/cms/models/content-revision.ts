import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import type { ContentEvent, SeoData } from "../types";

export interface ContentRevisionDoc {
  entryId: string;
  version: number;
  event: ContentEvent;
  slug: string;
  title: string;
  data: Record<string, unknown>;
  seo: SeoData;
  actorId: string;
  actorEmail: string;
}

const contentRevisionSchema = new Schema<ContentRevisionDoc>(
  {
    entryId: { type: String, required: true },
    version: { type: Number, required: true },
    event: {
      type: String,
      enum: ["created", "saved", "published", "unpublished", "archived", "unarchived", "restored"],
      required: true,
    },
    slug: { type: String, required: true },
    title: { type: String, default: "" },
    data: { type: Schema.Types.Mixed, required: true },
    seo: { type: Schema.Types.Mixed, default: () => ({ noindex: false }) },
    actorId: { type: String, required: true },
    actorEmail: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
contentRevisionSchema.index({ entryId: 1, createdAt: -1 });

export const ContentRevision: Model<ContentRevisionDoc> =
  (models.ContentRevision as Model<ContentRevisionDoc> | undefined) ??
  model<ContentRevisionDoc>("ContentRevision", contentRevisionSchema);
