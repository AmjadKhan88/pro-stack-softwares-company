import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { AUDIT_ACTIONS, type AuditAction } from "../types";

export interface AuditLogDoc {
  action: AuditAction;
  actorId?: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    action: { type: String, enum: [...AUDIT_ACTIONS], required: true, index: true },
    actorId: { type: String },
    actorEmail: { type: String },
    targetType: { type: String },
    targetId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ createdAt: -1 });

export const AuditLog: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc> | undefined) ?? model<AuditLogDoc>("AuditLog", auditLogSchema);
