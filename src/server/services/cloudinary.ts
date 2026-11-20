import "server-only";
import { z } from "zod";
import { requireCloudinaryEnv } from "@/lib/env";
import { logger } from "@/server/logger";
import { ALLOWED_FORMATS, type UploadedAssetInfo } from "@/features/media/rules";
import { signParams } from "@/features/media/signing";

const API = "https://api.cloudinary.com/v1_1";

function basicAuth(apiKey: string, apiSecret: string): string {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

/** The signed instructions a browser needs to upload ONE file with ONE server-chosen name. */
export function buildSignedUpload(publicId: string): { url: string; fields: Record<string, string> } {
  const { cloudName, apiKey, apiSecret } = requireCloudinaryEnv();
  const params = {
    // Cloudinary rejects anything that isn't one of these formats.
    allowed_formats: ALLOWED_FORMATS.join(","),
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  return {
    url: `${API}/${cloudName}/image/upload`,
    fields: { ...params, api_key: apiKey, signature: signParams(params, apiSecret) },
  };
}

const assetSchema = z.object({
  public_id: z.string(),
  resource_type: z.string(),
  type: z.string(),
  format: z.string(),
  bytes: z.number(),
  width: z.number(),
  height: z.number(),
  secure_url: z.string(),
});

/** Asks Cloudinary itself what is stored under this name. Returns null if nothing is there. */
export async function fetchUploadedAsset(publicId: string): Promise<UploadedAssetInfo | null> {
  const { cloudName, apiKey, apiSecret } = requireCloudinaryEnv();
  const path = publicId.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${API}/${cloudName}/resources/image/upload/${path}`, {
    headers: { Authorization: basicAuth(apiKey, apiSecret) },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Cloudinary lookup failed with status ${response.status}`);
  const parsed = assetSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Cloudinary returned an unexpected response");
  return parsed.data;
}

/** Deletes an uploaded file. Safe to repeat: "not found" counts as deleted. */
export async function destroyUploadedAsset(publicId: string): Promise<void> {
  const { cloudName, apiKey, apiSecret } = requireCloudinaryEnv();
  const response = await fetch(`${API}/${cloudName}/image/destroy`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(apiKey, apiSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ public_id: publicId, invalidate: "true" }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Cloudinary delete failed with status ${response.status}`);
  const result = (await response.json()) as { result?: string };
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary delete returned "${result.result ?? "nothing"}"`);
  }
  logger.info({ publicId, result: result.result }, "cloudinary asset deleted");
}
