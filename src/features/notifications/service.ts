import "server-only";
import { paginate, type Paged } from "@/lib/list-links";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import { Notification } from "./models/notification";
import { NotificationPreference } from "./models/notification-preference";
import { categoriesFor, type EmailPreferences, type NotificationView } from "./types";

export async function countUnread(userId: string): Promise<number> {
  await connectToDatabase();
  return Notification.countDocuments({ recipientId: userId, readAt: { $exists: false } });
}

export async function listNotifications(
  userId: string,
  options: { page: number; unreadOnly: boolean },
): Promise<Paged<NotificationView>> {
  await connectToDatabase();
  const query: Record<string, unknown> = { recipientId: userId };
  if (options.unreadOnly) query.readAt = { $exists: false };
  const total = await Notification.countDocuments(query);
  const { page, pageCount, skip, limit } = paginate(total, options.page);
  const docs = await Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  return {
    rows: docs.map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      body: doc.body,
      read: Boolean(doc.readAt),
      createdAt: (doc as unknown as { createdAt: Date }).createdAt,
    })),
    total,
    page,
    pageCount,
  };
}

/** Marks one of THIS person's notifications as read and returns where it leads. Someone else's id finds nothing. */
export async function markRead(userId: string, id: string): Promise<string | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Notification.findOne({ _id: id, recipientId: userId }).lean();
  if (!doc) return null;
  if (!doc.readAt)
    await Notification.updateOne({ _id: id, recipientId: userId }, { $set: { readAt: new Date() } });
  return doc.href;
}

export async function markAllRead(userId: string): Promise<void> {
  await connectToDatabase();
  await Notification.updateMany(
    { recipientId: userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
}

export async function getEmailPreferences(userId: string): Promise<EmailPreferences> {
  await connectToDatabase();
  const doc = await NotificationPreference.findOne({ userId }).lean();
  return (doc?.email ?? {}) as EmailPreferences;
}

/** Saves a choice for every kind this role can receive. Anything else in the request is ignored. */
export async function saveEmailPreferences(
  userId: string,
  role: unknown,
  choices: EmailPreferences,
): Promise<void> {
  await connectToDatabase();
  const email: Record<string, boolean> = {};
  for (const category of categoriesFor(role)) email[category] = choices[category] === true;
  await NotificationPreference.updateOne({ userId }, { $set: { email } }, { upsert: true });
}
