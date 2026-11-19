import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connectToDatabase } from "@/server/db/mongoose";
import type { PublishedItem } from "./mapping";
import { ContentEntry } from "./models/content-entry";
import { SlugRedirect } from "./models/slug-redirect";
import { CONTENT_TYPE_INFO, type ContentType } from "./types";

// Public pages read only the PUBLISHED snapshot, never the draft. These results are cached; publishing,
// unpublishing and renaming call updateTag() on the tag below, so the website refreshes straight away.
// "hours" is only a safety net in case an invalidation is ever missed.

export async function readPublished(type: ContentType): Promise<PublishedItem[]> {
  "use cache";
  cacheTag("content", CONTENT_TYPE_INFO[type].tag);
  cacheLife("hours");

  await connectToDatabase();
  const docs = await ContentEntry.find({ type, status: "published", publishedSlug: { $type: "string" } })
    .sort({ publishedAt: 1, publishedSlug: 1 })
    .lean();
  return docs.map((doc) => ({
    slug: doc.publishedSlug as string,
    data: doc.published ?? {},
    seo: doc.publishedSeo ?? {},
  }));
}

/** If an old address was renamed, the live address to send visitors to. Null when there is no live target. */
export async function readRedirectTarget(type: ContentType, slug: string): Promise<string | null> {
  "use cache";
  cacheTag("content", CONTENT_TYPE_INFO[type].tag);
  cacheLife("hours");

  await connectToDatabase();
  const redirect = await SlugRedirect.findOne({ type, fromSlug: slug }).lean();
  if (!redirect) return null;
  const target = await ContentEntry.findOne({ _id: redirect.entryId, status: "published" }).lean();
  return target?.publishedSlug ?? null;
}
