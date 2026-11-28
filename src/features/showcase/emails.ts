import "server-only";
import { SUPPORT_WHATSAPP_URL } from "@/config/payments";
import { getServerEnv, requireAuthEnv } from "@/lib/env";
import { isEmailConfigured, sendEmail } from "@/server/email/send";
import { sourceRequestEmail } from "@/server/email/templates";
import { logger } from "@/server/logger";

/** Emails the buyer. Best effort: a failure is logged and never blocks the staff member or the buyer. */
export async function sendBuyerEmail(
  kind: "received" | "approved" | "rejected",
  order: { buyerEmail: string; buyerName: string; reference: string; offerTitle: string },
): Promise<void> {
  if (getServerEnv().NOTIFICATION_EMAILS === "off" || !isEmailConfigured()) return;
  try {
    await sendEmail({
      to: order.buyerEmail,
      ...sourceRequestEmail(kind, {
        name: order.buyerName,
        reference: order.reference,
        projectTitle: order.offerTitle,
        showcaseUrl: `${requireAuthEnv().baseURL}/showcase`,
        whatsappUrl: SUPPORT_WHATSAPP_URL,
      }),
    });
  } catch (error) {
    logger.warn({ err: error, reference: order.reference, kind }, "could not email the buyer");
  }
}
