import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { MediaAsset } from "@/features/media/models/media-asset";
import { isCloudinaryImageUrl } from "@/features/media/urls";
import { getServerEnv } from "@/lib/env";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import { blockAssetIds } from "./blocks";
import { asRecord, type PublishedAsset, type PublishedItem } from "./mapping";
import { ContentEntry } from "./models/content-entry";
import { SlugRedirect } from "./models/slug-redirect";
import { CONTENT_TYPE_INFO, type ContentType } from "./types";

// Public pages read only the PUBLISHED snapshot, never the draft. These results are cached; publishing,
// unpublishing, renaming and changing an image's description call updateTag() on the tags below, so the website
// refreshes straight away. "hours" is only a safety net in case an invalidation is ever missed.

export async function readPublished(type: ContentType): Promise<PublishedItem[]> {
  "use cache";
  cacheTag("content", CONTENT_TYPE_INFO[type].tag, "media");
  cacheLife("hours");

  await connectToDatabase();
  const docs = await ContentEntry.find({ type, status: "published", publishedSlug: { $type: "string" } })
    .sort({ publishedAt: 1, publishedSlug: 1 })
    .lean();

  // The images these pages use (main, sharing and inside blocks), looked up now so a changed description or an
  // archived image shows straight away.
  const wanted = new Set<string>();
  for (const doc of docs) {
    const published = asRecord(doc.published);
    const ids = [
      published.imageAssetId,
      asRecord(doc.publishedSeo).ogImageAssetId,
      ...blockAssetIds(published.blocks),
    ];
    for (const id of ids) if (typeof id === "string" && isObjectId(id)) wanted.add(id);
  }
  const assets: Record<string, PublishedAsset> = {};
  if (wanted.size > 0) {
    const { CLOUDINARY_CLOUD_NAME: cloudName } = getServerEnv();
    const found = await MediaAsset.find({ _id: { $in: [...wanted] }, status: "active" }).lean();
    for (const asset of found) {
      // Only our own cloud's images are ever handed to a page; anything else is skipped, never rendered.
      if (!cloudName || !isCloudinaryImageUrl(asset.secureUrl, cloudName)) continue;
      assets[String(asset._id)] = {
        id: String(asset._id),
        url: asset.secureUrl,
        width: asset.width,
        height: asset.height,
        alt: asset.altText,
      };
    }
  }

  return docs.map((doc) => ({
    slug: doc.publishedSlug as string,
    data: doc.published ?? {},
    seo: doc.publishedSeo ?? {},
    assets,
    publishedAt: doc.publishedAt?.toISOString(),
    updatedAt: (doc.lastPublishedAt ?? doc.publishedAt)?.toISOString(),
  }));
}

/**
 * Every renamed address of one type, as { oldSlug: liveSlug }. One cached map per type (not one cache entry per
 * address), so visitors guessing addresses can't fill the cache.
 */
export async function readRedirectMap(type: ContentType): Promise<Record<string, string>> {
  "use cache";
  cacheTag("content", CONTENT_TYPE_INFO[type].tag);
  cacheLife("hours");

  await connectToDatabase();
  const redirects = await SlugRedirect.find({ type }).lean();
  if (redirects.length === 0) return {};
  const live = await ContentEntry.find({
    _id: { $in: redirects.map((r) => r.entryId).filter(isObjectId) },
    status: "published",
  })
    .select("publishedSlug")
    .lean();
  const liveSlug = new Map(live.map((doc) => [String(doc._id), doc.publishedSlug]));
  const map: Record<string, string> = {};
  for (const redirect of redirects) {
    const target = liveSlug.get(redirect.entryId);
    if (target) map[redirect.fromSlug] = target;
  }
  return map;
}
