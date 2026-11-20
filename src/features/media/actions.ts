"use server";

import { revalidatePath, updateTag } from "next/cache";
import { logger } from "@/server/logger";
import { ForbiddenError, assertPermission } from "@/server/auth/session";
import { hashIdentifier } from "@/server/security/ip";
import { consumeRateLimit } from "@/server/security/rate-limit";
import {
  ALT_UPDATE_FIELDS,
  ASSET_ID_FIELDS,
  altUpdateSchema,
  assetIdSchema,
  finalizeSchema,
  pickFields,
  pickerSchema,
  requestUploadSchema,
} from "./schema";
import {
  archiveAsset,
  createUploadIntent,
  finalizeUpload,
  listPickerAssets,
  restoreAsset,
  updateAltText,
  type AssetResult,
} from "./service";
import type { FinalizeResult, MediaActionState, PickerResult, UploadRequestResult } from "./types";

const FAILED = "We couldn't complete that. Please try again.";

/** Step 1 of an upload: who, how often, and what file, are all checked here before any ticket exists. */
export async function requestUploadAction(input: unknown): Promise<UploadRequestResult> {
  try {
    const actor = await assertPermission("content.edit");
    const parsed = requestUploadSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Please check the file and description.",
      };
    }
    const limit = await consumeRateLimit({
      scope: "media-upload",
      identifier: hashIdentifier(actor.id),
      limit: 40,
      windowSeconds: 60 * 60,
    });
    if (!limit.allowed)
      return { ok: false, message: "You've uploaded a lot recently. Please try again later." };
    return await createUploadIntent({ user: actor, ...parsed.data });
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, message: error.message };
    logger.error({ err: error }, "requesting an upload failed");
    return { ok: false, message: FAILED };
  }
}

/** Step 2 of an upload: the server verifies what Cloudinary actually stored, then records it. */
export async function finalizeUploadAction(input: unknown): Promise<FinalizeResult> {
  try {
    const actor = await assertPermission("content.edit");
    const parsed = finalizeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "That upload isn't valid." };
    const result = await finalizeUpload({
      user: { id: actor.id, email: actor.email },
      publicId: parsed.data.publicId,
    });
    if (result.ok) revalidatePath("/admin/media", "layout");
    return result;
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, message: error.message };
    logger.error({ err: error }, "finishing an upload failed");
    return { ok: false, message: FAILED };
  }
}

export async function searchPickerAction(input: unknown): Promise<PickerResult> {
  try {
    await assertPermission("content.edit");
    const parsed = pickerSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "That search isn't valid." };
    const result = await listPickerAssets(parsed.data);
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, message: error.message };
    logger.error({ err: error }, "searching images failed");
    return { ok: false, message: FAILED };
  }
}

const ASSET_MESSAGES = {
  "not-found": "That image no longer exists.",
  "in-use": "This image is used by content. Remove it from there first.",
  "invalid-state": "That isn't available for the image's current status.",
} as const;

function describe(result: AssetResult, success: string): MediaActionState {
  if (result.ok) return { status: "success", message: success };
  if (result.reason === "in-use") {
    const count = result.usage ?? 1;
    return {
      status: "error",
      message: `Used by ${count} content ${count === 1 ? "item" : "items"}. Remove it from them before archiving.`,
    };
  }
  return { status: "error", message: ASSET_MESSAGES[result.reason] };
}

function refresh() {
  revalidatePath("/admin/media", "layout");
  // Public pages show the alt text and hide archived images, so they refresh too.
  updateTag("media");
}

export async function updateAltTextAction(
  _previous: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  try {
    const actor = await assertPermission("content.edit");
    const parsed = altUpdateSchema.safeParse(pickFields(formData, ALT_UPDATE_FIELDS));
    if (!parsed.success)
      return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the text." };
    const result = await updateAltText({
      actor: { id: actor.id, email: actor.email },
      id: parsed.data.assetId,
      altText: parsed.data.altText,
    });
    if (result.ok) refresh();
    return describe(result, "Description saved.");
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "updating image description failed");
    return { status: "error", message: FAILED };
  }
}

export async function archiveAssetAction(
  _previous: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  try {
    const actor = await assertPermission("content.edit");
    const parsed = assetIdSchema.safeParse(pickFields(formData, ASSET_ID_FIELDS));
    if (!parsed.success) return { status: "error", message: "That image isn't valid." };
    const result = await archiveAsset({
      actor: { id: actor.id, email: actor.email },
      id: parsed.data.assetId,
    });
    if (result.ok) refresh();
    return describe(result, "Archived. It no longer appears in the picker.");
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "archiving image failed");
    return { status: "error", message: FAILED };
  }
}

export async function restoreAssetAction(
  _previous: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  try {
    const actor = await assertPermission("content.edit");
    const parsed = assetIdSchema.safeParse(pickFields(formData, ASSET_ID_FIELDS));
    if (!parsed.success) return { status: "error", message: "That image isn't valid." };
    const result = await restoreAsset({
      actor: { id: actor.id, email: actor.email },
      id: parsed.data.assetId,
    });
    if (result.ok) refresh();
    return describe(result, "Restored.");
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "restoring image failed");
    return { status: "error", message: FAILED };
  }
}
