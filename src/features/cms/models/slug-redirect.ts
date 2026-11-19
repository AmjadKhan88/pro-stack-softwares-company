import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { CONTENT_TYPES, type ContentType } from "../types";

export interface SlugRedirectDoc {
  type: ContentType;
  fromSlug: string;
  /** Points at the item, not at a slug, so renaming twice never creates a chain of redirects. */
  entryId: string;
}

const slugRedirectSchema = new Schema<SlugRedirectDoc>(
  {
    type: { type: String, enum: [...CONTENT_TYPES], required: true },
    fromSlug: { type: String, required: true },
    entryId: { type: String, required: true },
  },
  { timestamps: true },
);
slugRedirectSchema.index({ type: 1, fromSlug: 1 }, { unique: true });

export const SlugRedirect: Model<SlugRedirectDoc> =
  (models.SlugRedirect as Model<SlugRedirectDoc> | undefined) ??
  model<SlugRedirectDoc>("SlugRedirect", slugRedirectSchema);
