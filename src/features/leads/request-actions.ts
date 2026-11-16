"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireClientContext } from "@/features/organizations/context";
import { logger } from "@/server/logger";
import { getClientIpHash, hashIdentifier } from "@/server/security/ip";
import { consumeRateLimit } from "@/server/security/rate-limit";
import {
  REQUEST_FIELDS,
  pickFields,
  portalRequestSchema,
  type PortalRequestField,
  type RequestState,
} from "./request-schema";
import { createPortalRequest } from "./request-service";

export async function submitProjectRequestAction(
  _previous: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const values = pickFields(formData, REQUEST_FIELDS);
  const { user, organization } = await requireClientContext("/portal/requests/new");
  if (!organization) {
    return { status: "error", message: "Your account isn't linked to an organization yet.", values };
  }

  const parsed = portalRequestSchema.safeParse(values);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([key, messages]) => [key, (messages as string[] | undefined)?.[0]]),
      ) as Partial<Record<PortalRequestField, string>>,
      values,
    };
  }

  try {
    // Five requests per person per day, so the form can't be used to flood the leads inbox.
    const limit = await consumeRateLimit({
      scope: "portal-request",
      identifier: hashIdentifier(user.id),
      limit: 5,
      windowSeconds: 24 * 60 * 60,
    });
    if (!limit.allowed) {
      return {
        status: "error",
        message: "You've sent several requests today. Please wait, or contact us directly.",
        values,
      };
    }
    void getClientIpHash; // (IP is not stored for signed-in requests)
    const { referenceCode } = await createPortalRequest({
      organization,
      user: { id: user.id, name: user.name, email: user.email },
      content: parsed.data,
    });
    revalidatePath("/portal/requests");
    revalidatePath("/admin/leads", "layout");
    revalidatePath("/admin");
    return { status: "success", referenceCode };
  } catch (error) {
    logger.error({ err: error }, "portal request failed");
    return { status: "error", message: "We couldn't send your request. Please try again.", values };
  }
}
