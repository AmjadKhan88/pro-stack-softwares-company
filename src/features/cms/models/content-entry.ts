import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import {
  CONTENT_STATUSES,
  CONTENT_TYPES,
  type ContentStatus,
  type ContentType,
  type SeoData,
} from "../types";

export interface ContentEntryDoc {
  type: ContentType;
  /** The editable address. The LIVE address is publishedSlug, which only changes when you publish. */
  slug: string;
  status: ContentStatus;
  /** The working copy. Never shown publicly. */
  draft: Record<string, unknown>;
  draftSeo: SeoData;
  /** Goes up by one on every save, so two editors can't silently overwrite each other. */
  draftVersion: number;
  /** The snapshot the public site shows. Present only while published. */
  published?: Record<string, unknown>;
  publishedSeo?: SeoData;
  publishedSlug?: string;
  publishedVersion?: number;
  publishedAt?: Date;
  createdBy: string;
  createdByEmail: string;
}

const seoSchema = new Schema<SeoData>(
  {
    metaTitle: { type: String, maxlength: 70 },
    metaDescription: { type: String, maxlength: 170 },
    noindex: { type: Boolean, default: false },
    ogImageAssetId: { type: String },
  },
  { _id: false },
);

const contentEntrySchema = new Schema<ContentEntryDoc>(
  {
    type: { type: String, enum: [...CONTENT_TYPES], required: true },
    slug: { type: String, required: true },
    status: { type: String, enum: [...CONTENT_STATUSES], default: "draft" },
    draft: { type: Schema.Types.Mixed, required: true },
    draftSeo: { type: seoSchema, default: () => ({ noindex: false }) },
    draftVersion: { type: Number, required: true, default: 1 },
    published: { type: Schema.Types.Mixed },
    publishedSeo: { type: seoSchema },
    publishedSlug: { type: String },
    publishedVersion: { type: Number },
    publishedAt: { type: Date },
    createdBy: { type: String, required: true },
    createdByEmail: { type: String, required: true },
  },
  { timestamps: true },
);
contentEntrySchema.index({ type: 1, slug: 1 }, { unique: true });
// A live address can belong to only one published item of a type.
contentEntrySchema.index(
  { type: 1, publishedSlug: 1 },
  { unique: true, partialFilterExpression: { publishedSlug: { $type: "string" } } },
);
contentEntrySchema.index({ type: 1, status: 1, updatedAt: -1 });

export const ContentEntry: Model<ContentEntryDoc> =
  (models.ContentEntry as Model<ContentEntryDoc> | undefined) ??
  model<ContentEntryDoc>("ContentEntry", contentEntrySchema);
