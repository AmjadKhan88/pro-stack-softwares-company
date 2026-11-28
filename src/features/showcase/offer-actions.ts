"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { canManageSales } from "./access";
import { createOffer, updateOffer } from "./offer-service";
import { OFFER_FIELDS, firstErrors, offerSchema } from "./schema";
import type { ActionState } from "./types";

export async function saveOfferAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff("/admin/source-code/offers");
  if (!canManageSales(user.role)) return { status: "error", message: "You don't have access to this." };

  const raw = Object.fromEntries(
    OFFER_FIELDS.map((field) => {
      const value = formData.get(field);
      return [field, typeof value === "string" ? value : undefined];
    }),
  );
  const parsed = offerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: firstErrors(parsed.error),
    };
  }

  let created = false;
  try {
    const result = parsed.data.id
      ? await updateOffer(parsed.data.id, parsed.data)
      : await createOffer(parsed.data, user.id);
    if (!result.ok) {
      return {
        status: "error",
        message: result.message,
        fieldErrors: result.field === "slug" ? { slug: result.message } : undefined,
      };
    }
    created = !parsed.data.id;
  } catch (error) {
    logger.error({ err: error }, "saving a source code offer failed");
    return { status: "error", message: "We couldn't save that. Please try again." };
  }

  updateTag("showcase"); // the public pages show the change straight away
  revalidatePath("/admin/source-code/offers");
  if (created) redirect("/admin/source-code/offers");
  return { status: "success", message: "Saved." };
}
