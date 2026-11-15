"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isObjectId } from "@/lib/object-id";
import { pickFields } from "@/lib/form-fields";
import { logger } from "@/server/logger";
import { ForbiddenError, assertPermission } from "@/server/auth/session";
import { linkExistingClient } from "./link-service";

const linkSchema = z.strictObject({
  organizationId: z.string().refine(isObjectId, "Invalid organization."),
  userId: z.string().refine(isObjectId, "Choose a client account."),
});
const LINK_FIELDS = ["organizationId", "userId"] as const;

export type LinkClientState =
  { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

export const initialLinkClientState: LinkClientState = { status: "idle" };

export async function linkClientAction(
  _previous: LinkClientState,
  formData: FormData,
): Promise<LinkClientState> {
  try {
    const actor = await assertPermission("clients.manage");
    const parsed = linkSchema.safeParse(pickFields(formData, LINK_FIELDS));
    if (!parsed.success)
      return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid request." };

    const result = await linkExistingClient({
      actor: { id: actor.id, email: actor.email },
      organizationId: parsed.data.organizationId,
      userId: parsed.data.userId,
    });
    if (!result.ok) {
      const messages = {
        "organization-not-found": "That organization doesn't exist or is archived.",
        "user-not-found": "That account no longer exists.",
        "not-a-client": "Only client accounts can be linked to an organization.",
        "already-linked": "That account already belongs to an organization.",
      } as const;
      return { status: "error", message: messages[result.reason] };
    }
    revalidatePath("/admin/clients", "layout");
    revalidatePath("/admin/users", "layout");
    revalidatePath("/portal", "layout");
    return {
      status: "success",
      message: "Account linked. They'll see this organization's work next time they open the portal.",
    };
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "linking client failed");
    return { status: "error", message: "We couldn't link the account. Please try again." };
  }
}
