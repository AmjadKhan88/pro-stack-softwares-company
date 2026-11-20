"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { logger } from "@/server/logger";
import { ForbiddenError, assertPermission, type SessionUser } from "@/server/auth/session";
import type { Permission } from "@/server/policies/permissions";
import {
  CONTENT_FORM_FIELDS,
  ENTRY_ID_FIELDS,
  ENTRY_VERSION_FIELDS,
  RESTORE_FIELDS,
  entryIdSchema,
  entryVersionSchema,
  parseContentForm,
  pickFields,
  restoreSchema,
} from "./schema";
import {
  archiveEntry,
  createEntry,
  publishEntry,
  restoreRevision,
  saveDraft,
  unarchiveEntry,
  unpublishEntry,
  type LifecycleResult,
  type PublishResult,
} from "./service";
import type { ContentActionState, ContentFormState } from "./state";
import { CONTENT_TYPE_INFO, isContentType } from "./types";

const who = (actor: SessionUser) => ({ id: actor.id, email: actor.email });
const IMAGE_UNAVAILABLE = "A chosen image is no longer available. Choose another, or remove it.";

/** Runs a staff action after checking the permission on the server, with consistent error handling. */
async function run(
  permission: Permission,
  work: (actor: SessionUser) => Promise<ContentActionState>,
): Promise<ContentActionState> {
  try {
    const actor = await assertPermission(permission);
    return await work(actor);
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "content action failed");
    return { status: "error", message: "We couldn't complete that. Please try again." };
  }
}

const CONFLICT =
  "Someone saved a newer version while you had this open. Reload the page to see it before changing anything.";
const SLUG_TAKEN = "Another item already uses this URL slug. Choose a different one.";

// ---------------------------------------------------------------- create and save

export async function createContentAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const type = formData.get("contentType");
  if (!isContentType(type)) return { status: "error", message: "Unknown content type." };
  const raw = pickFields(formData, CONTENT_FORM_FIELDS[type]);
  const info = CONTENT_TYPE_INFO[type];

  let createdId: string;
  try {
    const actor = await assertPermission("content.edit");
    const parsed = parseContentForm(type, raw);
    if (!parsed.ok) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: parsed.fieldErrors,
        values: raw,
      };
    }
    const result = await createEntry({ type, parsed: parsed.value, actor: who(actor) });
    if (!result.ok) {
      const slugTaken = result.reason === "slug-taken";
      return {
        status: "error",
        message: slugTaken ? SLUG_TAKEN : IMAGE_UNAVAILABLE,
        fieldErrors: slugTaken ? { slug: SLUG_TAKEN } : undefined,
        values: raw,
      };
    }
    createdId = result.id;
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message, values: raw };
    logger.error({ err: error }, "creating content failed");
    return { status: "error", message: "We couldn't save it. Please try again.", values: raw };
  }
  revalidatePath(info.adminPath, "layout");
  redirect(`${info.adminPath}/${createdId}`);
}

export async function saveContentAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  const type = formData.get("contentType");
  if (!isContentType(type)) return { status: "error", message: "Unknown content type." };
  const raw = pickFields(formData, CONTENT_FORM_FIELDS[type]);
  const ids = entryVersionSchema.safeParse(pickFields(formData, ENTRY_VERSION_FIELDS));
  if (!ids.success) return { status: "error", message: "That item isn't valid.", values: raw };

  try {
    const actor = await assertPermission("content.edit");
    const parsed = parseContentForm(type, raw);
    if (!parsed.ok) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: parsed.fieldErrors,
        values: raw,
      };
    }
    const result = await saveDraft({
      id: ids.data.entryId,
      type,
      expectedVersion: ids.data.expectedVersion,
      parsed: parsed.value,
      actor: who(actor),
    });
    if (!result.ok) {
      const messages = {
        "not-found": "That item no longer exists.",
        archived: "This item is archived. Restore it before editing.",
        conflict: CONFLICT,
        "slug-taken": SLUG_TAKEN,
        "image-unavailable": IMAGE_UNAVAILABLE,
      } as const;
      return {
        status: "error",
        message: messages[result.reason],
        fieldErrors: result.reason === "slug-taken" ? { slug: SLUG_TAKEN } : undefined,
        values: raw,
      };
    }
    // Saving changes only the draft, so the public site is untouched and needs no refresh.
    revalidatePath(CONTENT_TYPE_INFO[type].adminPath, "layout");
    return { status: "success", message: "Draft saved. It is not public until you publish.", values: raw };
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message, values: raw };
    logger.error({ err: error }, "saving content failed");
    return { status: "error", message: "We couldn't save it. Please try again.", values: raw };
  }
}

// ---------------------------------------------------------------- lifecycle

function publishFailure(result: Extract<PublishResult, { ok: false }>): ContentActionState {
  if (result.reason === "incomplete") {
    return { status: "error", message: "This isn't ready to publish yet:", problems: result.problems };
  }
  const messages = {
    "not-found": "That item no longer exists.",
    archived: "Archived items can't be published. Restore it first.",
    conflict: CONFLICT,
    "slug-in-use": "Another published item already uses this URL slug. Change the slug, save, and try again.",
  } as const;
  return { status: "error", message: messages[result.reason] };
}

function lifecycleFailure(result: Extract<LifecycleResult, { ok: false }>): ContentActionState {
  const messages = {
    "not-found": "That item no longer exists.",
    "invalid-state": "That isn't available for the item's current status.",
    "slug-taken": SLUG_TAKEN,
  } as const;
  return { status: "error", message: messages[result.reason] };
}

export async function publishContentAction(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const parsed = entryVersionSchema.safeParse(pickFields(formData, ENTRY_VERSION_FIELDS));
  if (!parsed.success) return { status: "error", message: "That item isn't valid." };
  return run("content.publish", async (actor) => {
    const result = await publishEntry({
      id: parsed.data.entryId,
      expectedVersion: parsed.data.expectedVersion,
      actor: who(actor),
    });
    if (!result.ok) return publishFailure(result);
    updateTag(CONTENT_TYPE_INFO[result.type].tag); // the public site refreshes immediately
    revalidatePath(CONTENT_TYPE_INFO[result.type].adminPath, "layout");
    return { status: "success", message: "Published. It is live on the website now." };
  });
}

export async function unpublishContentAction(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const parsed = entryIdSchema.safeParse(pickFields(formData, ENTRY_ID_FIELDS));
  if (!parsed.success) return { status: "error", message: "That item isn't valid." };
  return run("content.publish", async (actor) => {
    const result = await unpublishEntry({ id: parsed.data.entryId, actor: who(actor) });
    if (!result.ok) return lifecycleFailure(result);
    updateTag(CONTENT_TYPE_INFO[result.type].tag);
    revalidatePath(CONTENT_TYPE_INFO[result.type].adminPath, "layout");
    return {
      status: "success",
      message: "Unpublished. It is no longer on the website, and the draft is kept.",
    };
  });
}

export async function archiveContentAction(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const parsed = entryIdSchema.safeParse(pickFields(formData, ENTRY_ID_FIELDS));
  if (!parsed.success) return { status: "error", message: "That item isn't valid." };
  return run("content.edit", async (actor) => {
    const result = await archiveEntry({ id: parsed.data.entryId, actor: who(actor) });
    if (!result.ok) return lifecycleFailure(result);
    revalidatePath(CONTENT_TYPE_INFO[result.type].adminPath, "layout");
    return { status: "success", message: "Archived. You can restore it any time." };
  });
}

export async function unarchiveContentAction(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const parsed = entryIdSchema.safeParse(pickFields(formData, ENTRY_ID_FIELDS));
  if (!parsed.success) return { status: "error", message: "That item isn't valid." };
  return run("content.edit", async (actor) => {
    const result = await unarchiveEntry({ id: parsed.data.entryId, actor: who(actor) });
    if (!result.ok) return lifecycleFailure(result);
    revalidatePath(CONTENT_TYPE_INFO[result.type].adminPath, "layout");
    return { status: "success", message: "Restored as a draft." };
  });
}

export async function restoreRevisionAction(
  _previous: ContentActionState,
  formData: FormData,
): Promise<ContentActionState> {
  const parsed = restoreSchema.safeParse(pickFields(formData, RESTORE_FIELDS));
  if (!parsed.success) return { status: "error", message: "That version isn't valid." };
  return run("content.edit", async (actor) => {
    const result = await restoreRevision({
      id: parsed.data.entryId,
      revisionId: parsed.data.revisionId,
      expectedVersion: parsed.data.expectedVersion,
      actor: who(actor),
    });
    if (!result.ok) {
      const messages = {
        "not-found": "That version no longer exists.",
        archived: "This item is archived. Restore it before editing.",
        conflict: CONFLICT,
        "slug-taken": SLUG_TAKEN,
      } as const;
      return { status: "error", message: messages[result.reason] };
    }
    revalidatePath("/admin/content", "layout");
    return {
      status: "success",
      message: "Loaded into the draft. Review it, then publish when you're ready.",
    };
  });
}
