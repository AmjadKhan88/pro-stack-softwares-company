// What may be uploaded, and how an upload is checked. Pure (no I/O) so every rule is easy to read and to test.

export const ALLOWED_FORMATS = ["jpg", "png", "webp"] as const;
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MIN_DIMENSION = 100;
export const MAX_DIMENSION = 6000;
/** Every upload lives under this prefix, so a "public id" can be recognised as ours. */
export const UPLOAD_FOLDER = "psc/site";
export const INTENT_MINUTES = 20;

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function extensionOf(filename: string): string | null {
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(filename.trim());
  return match ? match[1].toLowerCase() : null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A safe name to show in the library: no folders, no control characters, at most 120 characters. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "image").slice(0, 120);
}

/** Checks a file's declared details BEFORE any upload ticket is issued. Returns a message, or null if fine. */
export function validateUploadRequest(input: {
  filename: string;
  mimeType: string;
  size: number;
}): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    return "Choose a JPEG, PNG or WebP image.";
  }
  const extension = extensionOf(input.filename);
  if (!extension || EXTENSION_TO_MIME[extension] !== input.mimeType) {
    return "The file name must end in .jpg, .jpeg, .png or .webp and match the file type.";
  }
  if (!Number.isFinite(input.size) || input.size <= 0) return "That file is empty.";
  if (input.size > MAX_UPLOAD_BYTES) {
    return `Images can be up to ${formatBytes(MAX_UPLOAD_BYTES)}. This one is ${formatBytes(input.size)}.`;
  }
  return null;
}

const PUBLIC_ID_PATTERN = new RegExp(`^${UPLOAD_FOLDER}/[a-f0-9]{24}$`);

/** Public ids we create look like psc/site/<24 hex characters>. Anything else is not ours. */
export function isOwnPublicId(value: unknown): value is string {
  return typeof value === "string" && PUBLIC_ID_PATTERN.test(value);
}

/** What Cloudinary's own Admin API says about an uploaded file. This, never the browser, is the truth. */
export interface UploadedAssetInfo {
  public_id: string;
  resource_type: string;
  type: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  secure_url: string;
}

export type VerifyResult =
  | {
      ok: true;
      asset: {
        publicId: string;
        secureUrl: string;
        format: string;
        bytes: number;
        width: number;
        height: number;
      };
    }
  | { ok: false; message: string };

export function verifyUploadedAsset(input: {
  info: UploadedAssetInfo;
  expectedPublicId: string;
  cloudName: string;
}): VerifyResult {
  const { info, expectedPublicId, cloudName } = input;
  const fail = (message: string): VerifyResult => ({ ok: false, message });

  if (info.public_id !== expectedPublicId) return fail("The uploaded file doesn't match this request.");
  if (info.resource_type !== "image" || info.type !== "upload") return fail("Only images can be uploaded.");
  if (!(ALLOWED_FORMATS as readonly string[]).includes(info.format)) {
    return fail("Only JPEG, PNG and WebP images are allowed.");
  }
  if (!Number.isFinite(info.bytes) || info.bytes <= 0) return fail("That file is empty.");
  if (info.bytes > MAX_UPLOAD_BYTES) {
    return fail(
      `Images can be up to ${formatBytes(MAX_UPLOAD_BYTES)}. This one is ${formatBytes(info.bytes)}.`,
    );
  }
  for (const side of [info.width, info.height]) {
    if (!Number.isFinite(side) || side < MIN_DIMENSION || side > MAX_DIMENSION) {
      return fail(`Images must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} pixels on each side.`);
    }
  }
  const prefix = `https://res.cloudinary.com/${cloudName}/image/upload/`;
  if (!info.secure_url.startsWith(prefix) || !info.secure_url.includes(`/${expectedPublicId}.`)) {
    return fail("The uploaded file isn't in the expected place.");
  }
  return {
    ok: true,
    asset: {
      publicId: info.public_id,
      secureUrl: info.secure_url,
      format: info.format,
      bytes: info.bytes,
      width: info.width,
      height: info.height,
    },
  };
}
