import "server-only";
import { z } from "zod";
import { requireCloudinaryEnv } from "@/lib/env";
import { logger } from "@/server/logger";
import { DOWNLOAD_LINK_SECONDS, FILE_FORMATS, type StoredFileInfo } from "@/features/files/rules";
import { signParams } from "@/features/media/signing";

const API = "https://api.cloudinary.com/v1_1";

/** If Cloudinary ever reports "Invalid Signature" for downloads, change this to "sha1" (both are supported). */
const DOWNLOAD_SIGNATURE_ALGORITHM: "sha256" | "sha1" = "sha256";

function basicAuth(apiKey: string, apiSecret: string): string {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

/** Signed instructions for the browser to upload ONE file, stored PRIVATELY (type "authenticated"). */
export function buildSignedFileUpload(publicId: string): { url: string; fields: Record<string, string> } {
  const { cloudName, apiKey, apiSecret } = requireCloudinaryEnv();
  const params = {
    allowed_formats: FILE_FORMATS.join(","),
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
    // "authenticated" means no public address exists for this file: it can only be read with a signed request.
    type: "authenticated",
  };
  return {
    url: `${API}/${cloudName}/image/upload`,
    fields: { ...params, api_key: apiKey, signature: signParams(params, apiSecret) },
  };
}

const storedSchema = z.object({
  public_id: z.string(),
  resource_type: z.string(),
  type: z.string(),
  format: z.string(),
  bytes: z.number(),
});

/** Asks Cloudinary itself what is stored under this name. Returns null if nothing is there. */
export async function fetchStoredFile(publicId: string): Promise<StoredFileInfo | null> {
  const { cloudName, apiKey, apiSecret } = requireCloudinaryEnv();
  const path = publicId.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${API}/${cloudName}/resources/image/authenticated/${path}`, {
    headers: { Authorization: basicAuth(apiKey, apiSecret) },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Cloudinary lookup failed with status ${response.status}`);
  const parsed = storedSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Cloudinary returned an unexpected response");
  return parsed.data;
}

/** Deletes a stored file. Safe to repeat: "not found" counts as deleted. */
export async function destroyStoredFile(publicId: string): Promise<void> {
  const { cloudName, apiKey, apiSecret } = requireCloudinaryEnv();
  const response = await fetch(`${API}/${cloudName}/image/destroy`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(apiKey, apiSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ public_id: publicId, type: "authenticated", invalidate: "true" }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Cloudinary delete failed with status ${response.status}`);
  const result = (await response.json()) as { result?: string };
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary delete returned "${result.result ?? "nothing"}"`);
  }
  logger.info({ publicId, result: result.result }, "private file deleted from storage");
}

/**
 * A signed Cloudinary download address that expires after DOWNLOAD_LINK_SECONDS. It is used ONLY inside our server
 * (we fetch the file and pass it on), so no browser ever receives it.
 */
export function buildPrivateDownloadUrl(input: { publicId: string; format: string }): string {
  const { cloudName, apiKey, apiSecret } = requireCloudinaryEnv();
  const now = Math.floor(Date.now() / 1000);
  const params = {
    expires_at: String(now + DOWNLOAD_LINK_SECONDS),
    format: input.format,
    public_id: input.publicId,
    timestamp: String(now),
    type: "authenticated",
  };
  const signature = signParams(params, apiSecret, DOWNLOAD_SIGNATURE_ALGORITHM);
  const query = new URLSearchParams({ ...params, api_key: apiKey, signature });
  return `${API}/${cloudName}/image/download?${query.toString()}`;
}
