"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { markAllRead, markRead, saveEmailPreferences } from "./service";
import { categoriesFor, type EmailPreferences, type PreferencesState } from "./types";
import { isObjectId } from "@/lib/object-id";

function refresh() {
  revalidatePath("/portal/notifications");
  revalidatePath("/admin/notifications");
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const id = formData.get("id");
  if (!user || typeof id !== "string" || !isObjectId(id)) return;
  await markRead(user.id, id);
  refresh();
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await markAllRead(user.id);
  refresh();
}

export async function savePreferencesAction(
  _previous: PreferencesState,
  formData: FormData,
): Promise<PreferencesState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Please sign in again." };
  try {
    const choices: EmailPreferences = {};
    // An unticked box sends nothing, so every kind this role can receive is read explicitly.
    for (const category of categoriesFor(user.role)) choices[category] = formData.get(category) === "on";
    await saveEmailPreferences(user.id, user.role, choices);
    refresh();
    return { status: "success", message: "Saved." };
  } catch (error) {
    logger.error({ err: error }, "saving notification preferences failed");
    return { status: "error", message: "We couldn't save that. Please try again." };
  }
}
