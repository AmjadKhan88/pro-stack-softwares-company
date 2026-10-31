import "server-only";
import type { ClientSession } from "mongoose";
import { connectToDatabase } from "@/server/db/mongoose";
import { AuditLog } from "./models/audit-log";
import { redactMetadata } from "./redact";
import type { AuditActor, AuditAction, AuditTarget } from "./types";

interface AuditEntry {
  action: AuditAction;
  actor: AuditActor | null;
  target?: AuditTarget;
  metadata?: Record<string, unknown>;
}

/** Records a privileged action. Pass the transaction session so the record commits (or rolls back) with the change. */
export async function recordAudit(entry: AuditEntry, session?: ClientSession): Promise<void> {
  await connectToDatabase();
  await AuditLog.create(
    [
      {
        action: entry.action,
        actorId: entry.actor?.id,
        actorEmail: entry.actor?.email,
        targetType: entry.target?.type,
        targetId: entry.target?.id,
        metadata: redactMetadata(entry.metadata ?? {}) as Record<string, unknown>,
      },
    ],
    { session },
  );
}

export interface AuditRow {
  id: string;
  action: AuditAction;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: Date;
}

export async function listAuditLogs(limit = 100): Promise<AuditRow[]> {
  await connectToDatabase();
  const rows = await AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((row) => ({
    id: String(row._id),
    action: row.action,
    actorEmail: row.actorEmail ?? null,
    targetType: row.targetType ?? null,
    targetId: row.targetId ?? null,
    createdAt: (row as unknown as { createdAt: Date }).createdAt,
  }));
}
