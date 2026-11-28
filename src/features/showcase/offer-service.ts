import "server-only";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import { SourceOffer, type SourceOfferDoc } from "./models/source-offer";
import { isValidSlug, slugifyTitle } from "./rules";
import type { OfferInput } from "./schema";
import type { OfferRow } from "./types";

type OfferLean = SourceOfferDoc & { _id: unknown };

export function toOfferRow(doc: OfferLean): OfferRow {
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    description: doc.description ?? "",
    techStack: doc.techStack ?? [],
    liveUrl: doc.liveUrl ?? null,
    caseStudySlug: doc.caseStudySlug ?? null,
    priceMinor: doc.priceMinor,
    status: doc.status,
    sortOrder: doc.sortOrder ?? 0,
  };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function listOffersAdmin(): Promise<OfferRow[]> {
  await connectToDatabase();
  const docs = await SourceOffer.find().sort({ sortOrder: 1, createdAt: -1 }).limit(200).lean();
  return docs.map(toOfferRow);
}

export async function getOfferAdmin(id: string): Promise<OfferRow | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const doc = await SourceOffer.findById(id).lean();
  return doc ? toOfferRow(doc) : null;
}

/** A fresh (never cached) read of an offer a buyer may still order. */
export async function findActiveOfferById(
  id: string,
): Promise<{ id: string; title: string; priceMinor: number } | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const doc = await SourceOffer.findOne({ _id: id, status: "active" }).lean();
  return doc ? { id: String(doc._id), title: doc.title, priceMinor: doc.priceMinor } : null;
}

type SaveResult = { ok: true; id: string } | { ok: false; field: "slug" | "form"; message: string };

export async function createOffer(data: OfferInput, actorId: string): Promise<SaveResult> {
  await connectToDatabase();
  const slug = data.slug ?? slugifyTitle(data.title);
  if (!isValidSlug(slug))
    return { ok: false, field: "slug", message: "Add an address made of letters and numbers." };
  if (await SourceOffer.exists({ slug }))
    return { ok: false, field: "slug", message: "That address is already used by another project." };
  try {
    const created = await SourceOffer.create({
      slug,
      title: data.title,
      summary: data.summary,
      description: data.description,
      techStack: data.techStack,
      liveUrl: data.liveUrl,
      caseStudySlug: data.caseStudySlug,
      priceMinor: data.price,
      status: data.status,
      sortOrder: data.sortOrder,
      createdBy: actorId,
    });
    return { ok: true, id: String(created._id) };
  } catch (error) {
    if (isDuplicateKey(error))
      return { ok: false, field: "slug", message: "That address is already used by another project." };
    throw error;
  }
}

/** The address (slug) of a project never changes after it is created, so shared links keep working. */
export async function updateOffer(id: string, data: OfferInput): Promise<SaveResult> {
  if (!isObjectId(id)) return { ok: false, field: "form", message: "That project doesn't exist." };
  await connectToDatabase();
  const updated = await SourceOffer.findByIdAndUpdate(
    id,
    {
      $set: {
        title: data.title,
        summary: data.summary,
        description: data.description ?? "",
        techStack: data.techStack,
        liveUrl: data.liveUrl ?? "",
        caseStudySlug: data.caseStudySlug ?? "",
        priceMinor: data.price,
        status: data.status,
        sortOrder: data.sortOrder,
      },
    },
    { returnDocument: "after" },
  ).lean();
  return updated ? { ok: true, id } : { ok: false, field: "form", message: "That project doesn't exist." };
}
