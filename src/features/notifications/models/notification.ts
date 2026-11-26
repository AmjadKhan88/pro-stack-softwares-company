import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { CATEGORIES, NOTIFICATION_KINDS, type Category, type NotificationKind } from "../types";

export type EmailStatus = "none" | "pending" | "sending" | "sent" | "failed" | "skipped";

export interface NotificationDoc {
  recipientId: string;
  kind: NotificationKind;
  category: Category;
  title: string;
  body: string;
  /** Always a path on this website. */
  href: string;
  entityType?: string;
  entityId?: string;
  /** The audit entry that caused it. Together with the recipient it can only exist once. */
  auditId?: string;
  readAt?: Date;
  emailStatus: EmailStatus;
  emailAttempts: number;
  emailNextAttemptAt?: Date;
  emailClaimedAt?: Date;
  emailSentAt?: Date;
  emailError?: string;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    recipientId: { type: String, required: true },
    kind: { type: String, enum: [...NOTIFICATION_KINDS], required: true },
    category: { type: String, enum: [...CATEGORIES], required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: "", maxlength: 200 },
    href: { type: String, required: true, maxlength: 300 },
    entityType: { type: String },
    entityId: { type: String },
    auditId: { type: String },
    readAt: { type: Date },
    emailStatus: {
      type: String,
      enum: ["none", "pending", "sending", "sent", "failed", "skipped"],
      default: "none",
    },
    emailAttempts: { type: Number, default: 0 },
    emailNextAttemptAt: { type: Date },
    emailClaimedAt: { type: Date },
    emailSentAt: { type: Date },
    emailError: { type: String, maxlength: 200 },
  },
  { timestamps: true },
);
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });
notificationSchema.index({ emailStatus: 1, emailNextAttemptAt: 1 });
notificationSchema.index(
  { auditId: 1, recipientId: 1 },
  { unique: true, partialFilterExpression: { auditId: { $type: "string" } } },
);

export const Notification: Model<NotificationDoc> =
  (models.Notification as Model<NotificationDoc> | undefined) ??
  model<NotificationDoc>("Notification", notificationSchema);
