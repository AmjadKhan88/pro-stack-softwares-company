import "server-only";
import type { ClientSession } from "mongodb";
import { getMongoDb } from "@/server/db/mongo-client";
import { redactMetadata } from "./redact";
import type { AuditAction, AuditActor, AuditTarget } from "./types";

/**
 * Writes an audit record through the native MongoDB driver so it can join a native transaction. Better Auth owns
 * the user collection, so account changes use this to keep the change and its audit record atomic.
 */
export async function recordAuditNative(
  entry: { action: AuditAction; actor: AuditActor; target?: AuditTarget; metadata?: Record<string, unknown> },
  session: ClientSession,
): Promise<void> {
  await getMongoDb()
    .collection("auditlogs")
    .insertOne(
      {
        action: entry.action,
        actorId: entry.actor.id,
        actorEmail: entry.actor.email,
        targetType: entry.target?.type,
        targetId: entry.target?.id,
        metadata: redactMetadata(entry.metadata ?? {}),
        createdAt: new Date(),
      },
      { session },
    );
}
