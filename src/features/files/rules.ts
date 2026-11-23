// Rules for private project files. Pure (no I/O) so every rule is easy to read and to test.
import { canReadProject } from "@/features/projects/access-rules";
import { extensionOf, sanitizeFilename } from "@/features/media/rules";

export const FILE_FORMATS = ["pdf", "png", "jpg", "webp"] as const;
export type FileFormat = (typeof FILE_FORMATS)[number];
export const FILE_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Every private file lives under this prefix, so a "public id" can be recognised as ours. */
export const FILE_FOLDER = "psc/files";
export const FILE_INTENT_MINUTES = 20;
/** How long the link that our server asks Cloudinary for stays valid. */
export const DOWNLOAD_LINK_SECONDS = 60;

const EXTENSION_TO_FORMAT: Record<string, FileFormat> = {
  pdf: "pdf",
  png: "png",
  jpg: "jpg",
  jpeg: "jpg",
  webp: "webp",
};
const MIME_TO_FORMAT: Record<string, FileFormat> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const FORMAT_TO_CONTENT_TYPE: Record<FileFormat, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export function isFileFormat(value: unknown): value is FileFormat {
  return typeof value === "string" && (FILE_FORMATS as readonly string[]).includes(value);
}

export function contentTypeForFormat(format: string): string | null {
  return isFileFormat(format) ? FORMAT_TO_CONTENT_TYPE[format] : null;
}

/** The format a file will be stored as, or null if the type and file name don't agree. */
export function formatForUpload(input: { filename: string; mimeType: string }): FileFormat | null {
  if (!Object.hasOwn(MIME_TO_FORMAT, input.mimeType)) return null;
  const extension = extensionOf(input.filename);
  if (!extension || !Object.hasOwn(EXTENSION_TO_FORMAT, extension)) return null;
  return EXTENSION_TO_FORMAT[extension] === MIME_TO_FORMAT[input.mimeType]
    ? MIME_TO_FORMAT[input.mimeType]
    : null;
}

export function validateFileRequest(input: {
  filename: string;
  mimeType: string;
  size: number;
}): string | null {
  if (!(FILE_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    return "Choose a PDF, PNG, JPEG or WebP file.";
  }
  if (formatForUpload(input) === null) {
    return "The file name must end in .pdf, .png, .jpg, .jpeg or .webp and match the file type.";
  }
  if (!Number.isFinite(input.size) || input.size <= 0) return "That file is empty.";
  if (input.size > MAX_FILE_BYTES) return "Files can be up to 10 MB.";
  return null;
}

const FILE_ID_PATTERN = new RegExp(`^${FILE_FOLDER}/[a-f0-9]{24}$`);

/** Public ids we create look like psc/files/<24 hex characters>. Anything else is not ours. */
export function isOwnFilePublicId(value: unknown): value is string {
  return typeof value === "string" && FILE_ID_PATTERN.test(value);
}

/** What Cloudinary's own Admin API says about a stored file. This, never the browser, is the truth. */
export interface StoredFileInfo {
  public_id: string;
  resource_type: string;
  type: string;
  format: string;
  bytes: number;
}

export type VerifyFileResult =
  { ok: true; format: FileFormat; bytes: number } | { ok: false; message: string };

export function verifyStoredFile(input: {
  info: StoredFileInfo;
  expectedPublicId: string;
  expectedFormat: FileFormat;
}): VerifyFileResult {
  const { info } = input;
  const fail = (message: string): VerifyFileResult => ({ ok: false, message });
  if (info.public_id !== input.expectedPublicId) return fail("The uploaded file doesn't match this request.");
  if (info.resource_type !== "image") return fail("That kind of file isn't allowed.");
  // The whole point: a private file must not be publicly reachable.
  if (info.type !== "authenticated") return fail("The file wasn't stored privately, so it was rejected.");
  if (!isFileFormat(info.format)) return fail("Only PDF, PNG, JPEG and WebP files are allowed.");
  if (info.format !== input.expectedFormat) return fail("The file type doesn't match what was selected.");
  if (!Number.isFinite(info.bytes) || info.bytes <= 0) return fail("That file is empty.");
  if (info.bytes > MAX_FILE_BYTES) return fail("Files can be up to 10 MB.");
  return { ok: true, format: info.format, bytes: info.bytes };
}

/** The name a downloaded file gets: the original name, made safe, with the true extension. */
export function downloadFilename(original: string, format: string): string {
  const base =
    sanitizeFilename(original)
      .replace(/\.[A-Za-z0-9]{1,5}$/, "")
      .trim() || "file";
  const extension = /^[a-z0-9]{1,5}$/.test(format) ? format : "bin";
  return `${base.slice(0, 100)}.${extension}`;
}

/** A Content-Disposition header that cannot be broken out of (no quotes, line breaks or odd characters). */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export interface ClientFileFacts {
  /** The organization of the signed-in client (from their account, never from the request). */
  clientOrganizationId: string | null;
  fileOrganizationId: string;
  fileStatus: string;
  fileClientVisible: boolean;
  hasDeliverable: boolean;
  deliverableClientVisible: boolean;
}

/**
 * Whether a CLIENT may see or download a file. Every condition must hold: their own organization, the file is
 * active and shown to clients, and (if it is attached to a deliverable) that deliverable is shown to clients too.
 */
export function clientMayDownload(facts: ClientFileFacts): boolean {
  return (
    facts.clientOrganizationId !== null &&
    facts.clientOrganizationId === facts.fileOrganizationId &&
    facts.fileStatus === "active" &&
    facts.fileClientVisible === true &&
    (!facts.hasDeliverable || facts.deliverableClientVisible === true)
  );
}

/** Whether STAFF may download a file: they must be allowed to read its project (developers need to be assigned). */
export function staffMayDownload(input: { role: unknown; isMember: boolean }): boolean {
  return canReadProject(input);
}
