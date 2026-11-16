import "server-only";
import type { AuditListFilters } from "@/features/lists/params";
import { paginate, type Paged } from "@/lib/list-links";
import { escapeRegex } from "@/lib/search";
import { connectToDatabase } from "@/server/db/mongoose";
import { AuditLog } from "./models/audit-log";
import type { AuditRow } from "./service";

export const AUDIT_PAGE_SIZE = 25;

export async function listAuditLogsPaged(filters: AuditListFilters): Promise<Paged<AuditRow>> {
  await connectToDatabase();
  const query: Record<string, unknown> = {};
  if (filters.action) query.action = filters.action;
  if (filters.q) query.actorEmail = new RegExp(escapeRegex(filters.q), "i");
  const total = await AuditLog.countDocuments(query);
  const { page, pageCount, skip, limit } = paginate(total, filters.page, AUDIT_PAGE_SIZE);
  const docs = await AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  return {
    rows: docs.map((doc) => ({
      id: String(doc._id),
      action: doc.action,
      actorEmail: doc.actorEmail ?? null,
      targetType: doc.targetType ?? null,
      targetId: doc.targetId ?? null,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt,
    })),
    total,
    page,
    pageCount,
  };
}
