import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { recordAudit } from "@/features/audit/service";
import type { AuditActor } from "@/features/audit/types";
import { ContentEntry } from "@/features/cms/models/content-entry";
import { requireCloudinaryEnv } from "@/lib/env";
import { paginate, type Paged } from "@/lib/list-links";
import { isObjectId } from "@/lib/object-id";
import { escapeRegex } from "@/lib/search";
import { logger } from "@/server/logger";
import { connectToDatabase } from "@/server/db/mongoose";
import { buildSignedUpload, destroyUploadedAsset, fetchUploadedAsset } from "@/server/services/cloudinary";
import { MediaAsset, type MediaAssetDoc } from "./models/media-asset";
import { MediaUploadIntent } from "./models/upload-intent";
import {
  INTENT_MINUTES,
  isOwnPublicId,
  sanitizeFilename,
  validateUploadRequest,
  verifyUploadedAsset,
} from "./rules";
import type { MediaFilters } from "./schema";
import { newPublicId } from "./signing";
import type { FinalizeResult, MediaRow, MediaView, UploadRequestResult } from "./types";

export const LIBRARY_PAGE_SIZE = 12;

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

async function withSession<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let value!: T;
    await session.withTransaction(async () => {
      value = await work(session);
    });
    return value;
  } finally {
    await session.endSession();
  }
}

type LeanAsset = MediaAssetDoc & { _id: unknown };

export function toMediaView(doc: LeanAsset): MediaView {
  return {
    id: String(doc._id),
    url: doc.secureUrl,
    width: doc.width,
    height: doc.height,
    alt: doc.altText,
    filename: doc.originalFilename,
    format: doc.format,
    bytes: doc.bytes,
  };
}

// ---------------------------------------------------------------- uploading

/** Step 1: check the request and issue a one-use, short-lived ticket plus signed upload instructions. */
export async function createUploadIntent(input: {
  user: { id: string };
  filename: string;
  mimeType: string;
  size: number;
  altText: string;
}): Promise<UploadRequestResult> {
  const problem = validateUploadRequest({
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.size,
  });
  if (problem) return { ok: false, message: problem };

  await connectToDatabase();
  const publicId = newPublicId();
  await MediaUploadIntent.create({
    publicId,
    userId: input.user.id,
    altText: input.altText,
    originalFilename: sanitizeFilename(input.filename),
    expiresAt: new Date(Date.now() + INTENT_MINUTES * 60_000),
  });
  return { ok: true, upload: { ...buildSignedUpload(publicId), publicId } };
}

/**
 * Step 2, after the browser has uploaded. The server asks Cloudinary what was actually stored, checks it against
 * the rules, and only then creates the library record. A file that fails the checks is deleted from Cloudinary.
 */
export async function finalizeUpload(input: { user: AuditActor; publicId: string }): Promise<FinalizeResult> {
  if (!isOwnPublicId(input.publicId)) return { ok: false, message: "That upload isn't valid." };
  await connectToDatabase();

  const existing = await MediaAsset.findOne({ publicId: input.publicId, uploadedBy: input.user.id }).lean();
  if (existing) return { ok: true, assetId: String(existing._id) }; // finishing twice is harmless

  // Only the person who asked for this ticket, before it expires, and only once.
  const intent = await MediaUploadIntent.findOne({ publicId: input.publicId, userId: input.user.id }).lean();
  if (!intent || intent.expiresAt.getTime() < Date.now() || intent.consumedAt) {
    return { ok: false, message: "This upload has expired. Please upload the image again." };
  }

  const info = await fetchUploadedAsset(input.publicId);
  if (!info) return { ok: false, message: "We couldn't find the uploaded image. Please try again." };

  const { cloudName } = requireCloudinaryEnv();
  const check = verifyUploadedAsset({ info, expectedPublicId: input.publicId, cloudName });
  if (!check.ok) {
    try {
      await destroyUploadedAsset(input.publicId);
    } catch (error) {
      logger.error({ err: error, publicId: input.publicId }, "could not delete a rejected upload");
    }
    await MediaUploadIntent.deleteOne({ _id: intent._id });
    return { ok: false, message: check.message };
  }

  try {
    return await withSession<FinalizeResult>(async (session) => {
      const [created] = await MediaAsset.create(
        [
          {
            ...{ publicId: check.asset.publicId, secureUrl: check.asset.secureUrl },
            format: check.asset.format,
            bytes: check.asset.bytes,
            width: check.asset.width,
            height: check.asset.height,
            altText: intent.altText,
            originalFilename: intent.originalFilename,
            status: "active" as const,
            uploadedBy: input.user.id,
            uploadedByEmail: input.user.email,
          },
        ],
        { session },
      );
      await MediaUploadIntent.updateOne(
        { _id: intent._id },
        { $set: { consumedAt: new Date() } },
        { session },
      );
      await recordAudit(
        {
          actor: input.user,
          action: "media.uploaded",
          target: { type: "media", id: String(created._id) },
          metadata: {
            publicId: check.asset.publicId,
            bytes: check.asset.bytes,
            width: check.asset.width,
            height: check.asset.height,
          },
        },
        session,
      );
      return { ok: true, assetId: String(created._id) };
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      const again = await MediaAsset.findOne({ publicId: input.publicId }).lean();
      if (again) return { ok: true, assetId: String(again._id) };
    }
    throw error;
  }
}

// ---------------------------------------------------------------- managing

export type AssetResult =
  { ok: true } | { ok: false; reason: "not-found" | "in-use" | "invalid-state"; usage?: number };

/** How many content items (drafts or live) point at this image. */
async function countUsage(id: string): Promise<number> {
  return ContentEntry.countDocuments({
    $or: [
      { "draft.imageAssetId": id },
      { "draftSeo.ogImageAssetId": id },
      { "published.imageAssetId": id },
      { "publishedSeo.ogImageAssetId": id },
      { "draft.blocks.assetId": id },
      { "published.blocks.assetId": id },
    ],
  });
}

export async function updateAltText(input: {
  actor: AuditActor;
  id: string;
  altText: string;
}): Promise<AssetResult> {
  await connectToDatabase();
  return withSession<AssetResult>(async (session) => {
    const asset = await MediaAsset.findById(input.id).session(session).lean();
    if (!asset) return { ok: false, reason: "not-found" };
    await MediaAsset.updateOne({ _id: input.id }, { $set: { altText: input.altText } }, { session });
    await recordAudit(
      {
        actor: input.actor,
        action: "media.updated",
        target: { type: "media", id: input.id },
        metadata: { publicId: asset.publicId },
      },
      session,
    );
    return { ok: true };
  });
}

/** An image that content is using can't be archived: that would silently remove it from pages. */
export async function archiveAsset(input: { actor: AuditActor; id: string }): Promise<AssetResult> {
  await connectToDatabase();
  return withSession<AssetResult>(async (session) => {
    const asset = await MediaAsset.findById(input.id).session(session).lean();
    if (!asset) return { ok: false, reason: "not-found" };
    if (asset.status !== "active") return { ok: false, reason: "invalid-state" };
    const usage = await countUsage(input.id);
    if (usage > 0) return { ok: false, reason: "in-use", usage };
    await MediaAsset.updateOne(
      { _id: input.id, status: "active" },
      { $set: { status: "archived" } },
      { session },
    );
    await recordAudit(
      {
        actor: input.actor,
        action: "media.archived",
        target: { type: "media", id: input.id },
        metadata: { publicId: asset.publicId },
      },
      session,
    );
    return { ok: true };
  });
}

export async function restoreAsset(input: { actor: AuditActor; id: string }): Promise<AssetResult> {
  await connectToDatabase();
  return withSession<AssetResult>(async (session) => {
    const asset = await MediaAsset.findById(input.id).session(session).lean();
    if (!asset) return { ok: false, reason: "not-found" };
    if (asset.status !== "archived") return { ok: false, reason: "invalid-state" };
    await MediaAsset.updateOne(
      { _id: input.id, status: "archived" },
      { $set: { status: "active" } },
      { session },
    );
    await recordAudit(
      {
        actor: input.actor,
        action: "media.restored",
        target: { type: "media", id: input.id },
        metadata: { publicId: asset.publicId },
      },
      session,
    );
    return { ok: true };
  });
}

// ---------------------------------------------------------------- reads

function searchQuery(filters: { q?: string; status?: "active" | "archived" }): Record<string, unknown> {
  const query: Record<string, unknown> = { status: filters.status ?? "active" };
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [{ originalFilename: pattern }, { altText: pattern }];
  }
  return query;
}

export async function listAssets(filters: MediaFilters): Promise<Paged<MediaRow>> {
  await connectToDatabase();
  const query = searchQuery(filters);
  const total = await MediaAsset.countDocuments(query);
  const { page, pageCount, skip, limit } = paginate(total, filters.page, LIBRARY_PAGE_SIZE);
  const docs = await MediaAsset.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  const rows = await Promise.all(
    docs.map(async (doc) => ({
      ...toMediaView(doc),
      status: doc.status,
      usage: await countUsage(String(doc._id)),
      uploadedByEmail: doc.uploadedByEmail,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt,
    })),
  );
  return { rows, total, page, pageCount };
}

/** Active images only, for the picker inside the content editors. */
export async function listPickerAssets(input: { q?: string; page?: number }) {
  await connectToDatabase();
  const query = searchQuery({ q: input.q, status: "active" });
  const total = await MediaAsset.countDocuments(query);
  const { page, pageCount, skip, limit } = paginate(total, input.page ?? 1, LIBRARY_PAGE_SIZE);
  const docs = await MediaAsset.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  return { assets: docs.map(toMediaView), page, pageCount };
}

/** Active images by id (used to show what an editor has already chosen). */
export async function getMediaViewsByIds(ids: string[]): Promise<Record<string, MediaView>> {
  const valid = [...new Set(ids)].filter(isObjectId);
  if (valid.length === 0) return {};
  await connectToDatabase();
  const docs = await MediaAsset.find({ _id: { $in: valid }, status: "active" }).lean();
  return Object.fromEntries(docs.map((doc) => [String(doc._id), toMediaView(doc)]));
}
