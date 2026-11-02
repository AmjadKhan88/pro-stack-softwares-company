"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/server/logger";
import { ForbiddenError, assertPermission } from "@/server/auth/session";
import { ORGANIZATION_FIELDS, organizationSchema, pickFields, type OrganizationState } from "./schema";
import { createOrganization } from "./service";

export async function createOrganizationAction(
  _previous: OrganizationState,
  formData: FormData,
): Promise<OrganizationState> {
  try {
    const actor = await assertPermission("clients.manage");
    const parsed = organizationSchema.safeParse(pickFields(formData, ORGANIZATION_FIELDS));
    if (!parsed.success) {
      const { fieldErrors } = z.flattenError(parsed.error);
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: {
          name: fieldErrors.name?.[0],
          contactEmail: fieldErrors.contactEmail?.[0],
        },
      };
    }
    await createOrganization({
      actor: { id: actor.id, email: actor.email },
      name: parsed.data.name,
      contactEmail: parsed.data.contactEmail,
    });
    revalidatePath("/admin/clients");
    return { status: "success", message: `Organization "${parsed.data.name}" created.` };
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: "error", message: error.message };
    logger.error({ err: error }, "creating organization failed");
    return { status: "error", message: "We couldn't create the organization. Please try again." };
  }
}
