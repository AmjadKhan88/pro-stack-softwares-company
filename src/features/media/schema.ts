import { z } from "zod";
import { isObjectId } from "@/lib/object-id";
import { firstParam, parsePageParam } from "@/lib/search";
import { isOwnPublicId } from "./rules";

export { pickFields } from "@/lib/form-fields";

export const altTextSchema = z
  .string()
  .trim()
  .min(3, "Describe the image in a few words, for people who can't see it.")
  .max(200, "Keep the description under 200 characters.");

export const requestUploadSchema = z.strictObject({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  size: z.number().int().min(1).max(1_000_000_000),
  altText: altTextSchema,
});

export const finalizeSchema = z.strictObject({
  publicId: z.string().refine(isOwnPublicId, "That upload isn't valid."),
});

export const pickerSchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  page: z.number().int().min(1).max(10_000).optional(),
});

const objectId = z.string().refine(isObjectId, "Invalid image.");
export const assetIdSchema = z.strictObject({ assetId: objectId });
export const altUpdateSchema = z.strictObject({ assetId: objectId, altText: altTextSchema });
export const ASSET_ID_FIELDS = ["assetId"] as const;
export const ALT_UPDATE_FIELDS = ["assetId", "altText"] as const;

export interface MediaFilters {
  q?: string;
  status?: "active" | "archived";
  page: number;
}

/** Reads ?q=&status=&page= defensively: anything invalid is ignored rather than trusted. */
export function parseMediaFilters(params: Record<string, string | string[] | undefined>): MediaFilters {
  const status = firstParam(params.status);
  const q = (firstParam(params.q) ?? "").trim().slice(0, 100);
  return {
    q: q || undefined,
    status: status === "active" || status === "archived" ? status : undefined,
    page: parsePageParam(params.page),
  };
}
