"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/server/logger";
import { ForbiddenError, assertPermission } from "@/server/auth/session";
import { DENIAL_MESSAGES } from "./rules";
import {
  CHANGE_ROLE_FIELDS,
  STATUS_FIELDS,
  accountStatusSchema,
  changeRoleSchema,
  pickFields,
  type UserActionState,
} from "./schema";
import { changeUserRole, setAccountDisabled, type AccountResult } from "./service";

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}

function describe(result: AccountResult, success: string): UserActionState {
  if (result.ok) return { status: "success", message: success };
  if (result.reason === "not-found") return { status: "error", message: "That account no longer exists." };
  if (result.reason === "changed-elsewhere") {
    return {
      status: "error",
      message: "Someone else just changed this account. Reload the page and try again.",
    };
  }
  return { status: "error", message: DENIAL_MESSAGES[result.reason] };
}

function refresh() {
  revalidatePath("/admin/users", "layout");
  revalidatePath("/admin/projects", "layout");
}

export async function changeRoleAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const actor = await assertPermission("users.manage");
    const parsed = changeRoleSchema.safeParse(pickFields(formData, CHANGE_ROLE_FIELDS));
    if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };

    const result = await changeUserRole({
      actor: { id: actor.id, email: actor.email, role: actor.role },
      targetId: parsed.data.userId,
      newRole: parsed.data.role,
    });
    if (result.ok) refresh();
    return describe(result, "Role updated.");
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "changing role failed");
    return { status: "error", message: "We couldn't change the role. Please try again." };
  }
}

export async function accountStatusAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    const actor = await assertPermission("users.manage");
    const parsed = accountStatusSchema.safeParse(pickFields(formData, STATUS_FIELDS));
    if (!parsed.success) return { status: "error", message: firstMessage(parsed.error) };

    const disable = parsed.data.action === "disable";
    const result = await setAccountDisabled({
      actor: { id: actor.id, email: actor.email, role: actor.role },
      targetId: parsed.data.userId,
      disable,
      reason: parsed.data.reason,
    });
    if (result.ok) refresh();
    return describe(result, disable ? "Account disabled and signed out everywhere." : "Account re-enabled.");
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "changing account status failed");
    return { status: "error", message: "We couldn't update the account. Please try again." };
  }
}
