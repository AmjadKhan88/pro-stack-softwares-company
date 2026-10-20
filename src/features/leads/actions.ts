"use server";

import { z } from "zod";
import { logger } from "@/server/logger";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getClientIpHash, hashIdentifier } from "@/server/security/ip";
import { formDataToValues } from "./form-data";
import { inquirySchema, type InquiryField } from "./schema";
import { createLead } from "./service";
import type { InquiryState } from "./state";

export async function submitInquiry(_previous: InquiryState, formData: FormData): Promise<InquiryState> {
  const values = formDataToValues(formData);

  // Honeypot: real people never see or fill this field. Bots get a silent "success" and nothing is saved.
  const trap = formData.get("website");
  if (typeof trap === "string" && trap.length > 0) {
    return { status: "success", referenceCode: "PSC-RECEIVED" };
  }

  const parsed = inquirySchema.safeParse(values);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    const firstErrors = Object.fromEntries(
      Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.[0]]),
    ) as Partial<Record<InquiryField, string>>;
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: firstErrors,
      values,
    };
  }

  try {
    const ipHash = await getClientIpHash();
    const byIp = await consumeRateLimit({
      scope: "inquiry-ip",
      identifier: ipHash,
      limit: 5,
      windowSeconds: 60 * 60,
    });
    const byEmail = await consumeRateLimit({
      scope: "inquiry-email",
      identifier: hashIdentifier(parsed.data.email),
      limit: 3,
      windowSeconds: 24 * 60 * 60,
    });
    if (!byIp.allowed || !byEmail.allowed) {
      return {
        status: "error",
        message: "Too many requests. Please try again later, or contact us by email or WhatsApp.",
        values,
      };
    }

    const { referenceCode } = await createLead(parsed.data, ipHash);
    return { status: "success", referenceCode };
  } catch (error) {
    logger.error({ err: error }, "inquiry submission failed");
    return {
      status: "error",
      message: "We couldn't send your message right now. Please email or WhatsApp us instead.",
      values,
    };
  }
}
