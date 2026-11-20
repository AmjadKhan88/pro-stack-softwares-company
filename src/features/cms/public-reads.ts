import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { MediaAsset } from "@/features/media/models/media-asset";
import { isCloudinaryImageUrl } from "@/features/media/urls";
import { getServerEnv } from "@/lib/env";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
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

  // The images these pages use, looked up now so a changed description or an archived image shows straight away.
  const wanted = new Set<string>();
  for (const doc of docs) {
    const imageId = asRecord(doc.published).imageAssetId;
    const ogId = asRecord(doc.publishedSeo).ogImageAssetId;
    for (const id of [imageId, ogId]) if (typeof id === "string" && isObjectId(id)) wanted.add(id);
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
