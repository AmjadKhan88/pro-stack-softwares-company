"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/server/logger";
import { ForbiddenError, assertPermission } from "@/server/auth/session";
import { hashIdentifier } from "@/server/security/ip";
import { consumeRateLimit } from "@/server/security/rate-limit";
import {
  FILE_ID_FIELDS,
  FILE_VISIBILITY_FIELDS,
  fileIdSchema,
  fileVisibilitySchema,
  finalizeFileSchema,
  pickFields,
  requestFileUploadSchema,
} from "./schema";
import {
  archiveFile,
  createFileIntent,
  finalizeFileUpload,
  restoreFile,
  setFileVisibility,
  type FileResult,
} from "./service";
import type { FileActionState, FileFinalizeResult, FileUploadRequestResult } from "./types";

const FAILED = "We couldn't complete that. Please try again.";

function refresh() {
  revalidatePath("/admin/projects", "layout");
  revalidatePath("/portal", "layout");
}

/** Step 1 of a file upload: who, how often, and what file, are all checked before any ticket exists. */
export async function requestFileUploadAction(input: unknown): Promise<FileUploadRequestResult> {
  try {
    const actor = await assertPermission("projects.manage");
    const parsed = requestFileUploadSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the file." };
    const limit = await consumeRateLimit({
      scope: "file-upload",
      identifier: hashIdentifier(actor.id),
      limit: 40,
      windowSeconds: 60 * 60,
    });
    if (!limit.allowed)
      return { ok: false, message: "You've uploaded a lot recently. Please try again later." };
    return await createFileIntent({ actor: { id: actor.id, email: actor.email }, ...parsed.data });
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, message: error.message };
    logger.error({ err: error }, "requesting a file upload failed");
    return { ok: false, message: FAILED };
  }
}

/** Step 2: the server verifies what Cloudinary actually stored, then records it. */
export async function finalizeFileUploadAction(input: unknown): Promise<FileFinalizeResult> {
  try {
    const actor = await assertPermission("projects.manage");
    const parsed = finalizeFileSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "That upload isn't valid." };
    const result = await finalizeFileUpload({
      actor: { id: actor.id, email: actor.email },
      publicId: parsed.data.publicId,
    });
    if (result.ok) refresh();
    return result;
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, message: error.message };
    logger.error({ err: error }, "finishing a file upload failed");
    return { ok: false, message: FAILED };
  }
}

const MESSAGES = {
  "not-found": "That file no longer exists.",
  "project-closed": "This project is closed, so files can't be changed.",
  "invalid-state": "That isn't available for the file's current status.",
} as const;

function describe(result: FileResult, success: string): FileActionState {
  return result.ok
    ? { status: "success", message: success }
    : { status: "error", message: MESSAGES[result.reason] };
}

export async function fileVisibilityAction(
  _previous: FileActionState,
  formData: FormData,
): Promise<FileActionState> {
  try {
    const actor = await assertPermission("projects.manage");
    const parsed = fileVisibilitySchema.safeParse(pickFields(formData, FILE_VISIBILITY_FIELDS));
    if (!parsed.success) return { status: "error", message: "That file isn't valid." };
    const result = await setFileVisibility({
      actor: { id: actor.id, email: actor.email },
      id: parsed.data.fileId,
      visible: parsed.data.visible,
    });
    if (result.ok) refresh();
    return describe(
      result,
      parsed.data.visible ? "Now visible to the client." : "Now hidden from the client.",
    );
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "changing file visibility failed");
    return { status: "error", message: FAILED };
  }
}

export async function archiveFileAction(
  _previous: FileActionState,
  formData: FormData,
): Promise<FileActionState> {
  try {
    const actor = await assertPermission("projects.manage");
    const parsed = fileIdSchema.safeParse(pickFields(formData, FILE_ID_FIELDS));
    if (!parsed.success) return { status: "error", message: "That file isn't valid." };
    const result = await archiveFile({ actor: { id: actor.id, email: actor.email }, id: parsed.data.fileId });
    if (result.ok) refresh();
    return describe(result, "Archived. Clients can no longer download it.");
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "archiving file failed");
    return { status: "error", message: FAILED };
  }
}

export async function restoreFileAction(
  _previous: FileActionState,
  formData: FormData,
): Promise<FileActionState> {
  try {
    const actor = await assertPermission("projects.manage");
    const parsed = fileIdSchema.safeParse(pickFields(formData, FILE_ID_FIELDS));
    if (!parsed.success) return { status: "error", message: "That file isn't valid." };
    const result = await restoreFile({ actor: { id: actor.id, email: actor.email }, id: parsed.data.fileId });
    if (result.ok) refresh();
    return describe(result, "Restored.");
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "restoring file failed");
    return { status: "error", message: FAILED };
  }
}
