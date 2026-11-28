import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connectToDatabase } from "@/server/db/mongoose";
import { SourceOffer } from "./models/source-offer";
import { toOfferRow } from "./offer-service";
import type { PublicOffer } from "./types";

function toPublic(row: ReturnType<typeof toOfferRow>): PublicOffer {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    techStack: row.techStack,
    liveUrl: row.liveUrl,
    caseStudySlug: row.caseStudySlug,
    priceMinor: row.priceMinor,
  };
}

/** Projects that are for sale. Refreshed at once whenever you save a project in the admin. */
export async function listActiveOffers(): Promise<PublicOffer[]> {
  "use cache";
  cacheTag("showcase");
  cacheLife("hours");
  await connectToDatabase();
  const docs = await SourceOffer.find({ status: "active" })
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(100)
    .lean();
  return docs.map((doc) => toPublic(toOfferRow(doc)));
}

export async function getActiveOffer(slug: string): Promise<PublicOffer | null> {
  "use cache";
  cacheTag("showcase");
  cacheLife("hours");
  await connectToDatabase();
  const doc = await SourceOffer.findOne({ slug, status: "active" }).lean();
  return doc ? toPublic(toOfferRow(doc)) : null;
}
