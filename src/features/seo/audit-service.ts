import "server-only";
import { asRecord } from "@/features/cms/read-helpers";
import { ContentEntry } from "@/features/cms/models/content-entry";
import { MediaAsset } from "@/features/media/models/media-asset";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import {
  SEO_CONTENT_TYPES,
  auditItem,
  markDuplicates,
  sortRows,
  type SeoContentType,
  type SeoRow,
} from "./audit";

/** Every published service, case study, article and page, checked. Reads what is live, not drafts. */
export async function loadSeoRows(): Promise<SeoRow[]> {
  await connectToDatabase();
  const docs = await ContentEntry.find({
    type: { $in: [...SEO_CONTENT_TYPES] },
    status: "published",
    publishedSlug: { $type: "string" },
  })
    .limit(500)
    .lean();

  const wanted = new Set<string>();
  for (const doc of docs) {
    for (const id of [asRecord(doc.published).imageAssetId, asRecord(doc.publishedSeo).ogImageAssetId]) {
      if (typeof id === "string" && isObjectId(id)) wanted.add(id);
    }
  }
  const found = wanted.size
    ? await MediaAsset.find({ _id: { $in: [...wanted] }, status: "active" })
        .select("_id")
        .lean()
    : [];
  const available = new Set(found.map((asset) => String(asset._id)));

  const rows = docs.map((doc) =>
    auditItem({
      type: doc.type as SeoContentType,
      id: String(doc._id),
      slug: doc.publishedSlug as string,
      data: doc.published ?? {},
      seo: doc.publishedSeo ?? {},
      availableAssetIds: available,
    }),
  );
  return sortRows(markDuplicates(rows));
}
