import "server-only";
import { ObjectId } from "mongodb";
import { getServerEnv, requireAuthEnv } from "@/lib/env";
import { connectToDatabase } from "@/server/db/mongoose";
import { getMongoDb } from "@/server/db/mongo-client";
import { isEmailConfigured, sendEmail } from "@/server/email/send";
import { notificationEmail } from "@/server/email/templates";
import { logger } from "@/server/logger";
import { Notification, type NotificationDoc } from "./models/notification";
import { NotificationPreference } from "./models/notification-preference";
import { wantsEmail, type EmailPreferences } from "./types";

const MAX_ATTEMPTS = 3;

type Claimed = NotificationDoc & { _id: unknown };

async function finish(id: unknown, set: Record<string, unknown>) {
  await Notification.updateOne({ _id: id }, { $set: set });
}

/** Sends one claimed notification. Returns how it ended. */
async function sendOne(doc: Claimed): Promise<"sent" | "failed" | "skipped" | "retry"> {
  if (getServerEnv().NOTIFICATION_EMAILS === "off" || !isEmailConfigured()) {
    await finish(doc._id, { emailStatus: "skipped" });
    return "skipped";
  }
  const user = ObjectIdOrNull(doc.recipientId)
    ? await getMongoDb()
        .collection("user")
        .findOne({ _id: new ObjectId(doc.recipientId) }, { projection: { email: 1, role: 1, banned: 1 } })
    : null;
  if (!user || user.banned === true || typeof user.email !== "string") {
    await finish(doc._id, { emailStatus: "skipped" });
    return "skipped";
  }
  // Their choice counts at the moment of sending, not only when the notification was created.
  const pref = await NotificationPreference.findOne({ userId: doc.recipientId }).lean();
  if (!wantsEmail(user.role, doc.category, pref?.email as EmailPreferences | undefined)) {
    await finish(doc._id, { emailStatus: "skipped" });
    return "skipped";
  }

  try {
    const url = `${requireAuthEnv().baseURL}${doc.href}`;
    const result = (await sendEmail({
      to: user.email,
      ...notificationEmail({ title: doc.title, url }),
    })) as unknown;
    if (
      typeof result === "object" &&
      result !== null &&
      "ok" in result &&
      (result as { ok: unknown }).ok === false
    ) {
      throw new Error("The email provider did not accept the message");
    }
    await finish(doc._id, { emailStatus: "sent", emailSentAt: new Date() });
    return "sent";
  } catch (error) {
    const message = (error instanceof Error ? error.message : "Sending failed").slice(0, 200);
    logger.warn(
      { notificationId: String(doc._id), attempts: doc.emailAttempts, message },
      "notification email failed",
    );
    if (doc.emailAttempts >= MAX_ATTEMPTS) {
      await finish(doc._id, { emailStatus: "failed", emailError: message });
      return "failed";
    }
    await finish(doc._id, {
      emailStatus: "pending",
      emailError: message,
      emailNextAttemptAt: new Date(Date.now() + doc.emailAttempts * 5 * 60_000),
    });
    return "retry";
  }
}

function ObjectIdOrNull(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

/** Puts back emails that were claimed but never finished (for example the server stopped half-way). */
export async function releaseStaleClaims(): Promise<void> {
  await connectToDatabase();
  await Notification.updateMany(
    { emailStatus: "sending", emailClaimedAt: { $lt: new Date(Date.now() - 10 * 60_000) } },
    { $set: { emailStatus: "pending" } },
  );
}

/** Sends waiting emails, one at a time. Each is claimed first, so two runs can never send the same one twice. */
export async function dispatchPendingEmails(limit = 25) {
  await connectToDatabase();
  const counts = { sent: 0, failed: 0, skipped: 0, retry: 0 };
  for (let index = 0; index < limit; index += 1) {
    const now = new Date();
    const claimed = await Notification.findOneAndUpdate(
      {
        emailStatus: "pending",
        $or: [{ emailNextAttemptAt: { $exists: false } }, { emailNextAttemptAt: { $lte: now } }],
      },
      { $set: { emailStatus: "sending", emailClaimedAt: now }, $inc: { emailAttempts: 1 } },
      { sort: { createdAt: 1 }, returnDocument: "after" },
    ).lean();
    if (!claimed) break;
    counts[await sendOne(claimed)] += 1;
  }
  return counts;
}

/**
 * Asks Next.js to send waiting emails right after the current request has finished. Outside a request (a script)
 * this quietly does nothing: the scheduled job picks the emails up instead.
 */
export function scheduleEmailDispatch(): void {
  void import("next/server")
    .then(({ after }) => {
      try {
        after(async () => {
          try {
            await dispatchPendingEmails();
          } catch (error) {
            logger.error({ err: error }, "sending notification emails failed");
          }
        });
      } catch {
        /* not inside a request */
      }
    })
    .catch(() => undefined);
}
