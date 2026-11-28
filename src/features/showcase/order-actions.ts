"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireStaff } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { canManageSales } from "./access";
import { sendBuyerEmail } from "./emails";
import { changeOrderStatus, deleteProof } from "./order-service";
import { ORDER_STATUS_LABELS } from "./rules";
import { STATUS_FIELDS, firstErrors, statusChangeSchema } from "./schema";
import type { ActionState } from "./types";

function text(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function changeOrderStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireStaff("/admin/source-code");
  if (!canManageSales(user.role)) return { status: "error", message: "You don't have access to this." };

  const raw = Object.fromEntries(STATUS_FIELDS.map((field) => [field, text(formData.get(field))]));
  const parsed = statusChangeSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = firstErrors(parsed.error);
    return {
      status: "error",
      message: errors.note ?? errors.to ?? "Please check the form.",
      fieldErrors: errors,
    };
  }

  try {
    const result = await changeOrderStatus({
      id: parsed.data.id,
      to: parsed.data.to,
      note: parsed.data.note,
      actor: { id: user.id, email: user.email },
    });
    if (!result.ok) {
      const message =
        result.error === "not-found"
          ? "That request doesn't exist."
          : result.error === "not-allowed"
            ? "That change isn't possible from the current status."
            : "Someone just changed this request. Please reload the page.";
      return { status: "error", message };
    }
    revalidatePath("/admin/source-code");
    revalidatePath(`/admin/source-code/${parsed.data.id}`);
    // Tell the buyer once the change is saved.
    if (parsed.data.to === "approved" || parsed.data.to === "rejected") {
      const kind = parsed.data.to;
      const order = result.order;
      after(() => sendBuyerEmail(kind, order));
    }
    return { status: "success", message: `Marked as “${ORDER_STATUS_LABELS[parsed.data.to]}”.` };
  } catch (error) {
    logger.error({ err: error }, "changing a source request status failed");
    return { status: "error", message: "We couldn't save that. Please try again." };
  }
}

export async function deleteProofAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireStaff("/admin/source-code");
  if (!canManageSales(user.role)) return { status: "error", message: "You don't have access to this." };
  const id = text(formData.get("id")) ?? "";
  try {
    const result = await deleteProof(id, { id: user.id, email: user.email });
    if (result === "not-found") return { status: "error", message: "That request doesn't exist." };
    if (result === "not-finished")
      return {
        status: "error",
        message: "Only sent or rejected requests can have their screenshot deleted.",
      };
    revalidatePath(`/admin/source-code/${id}`);
    return { status: "success", message: "Screenshot deleted." };
  } catch (error) {
    logger.error({ err: error }, "deleting a payment screenshot failed");
    return { status: "error", message: "We couldn't delete that. Please try again." };
  }
}
