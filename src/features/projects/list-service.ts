import "server-only";
import { organizationNamesById } from "@/features/organizations/names";
import type { ProjectListFilters } from "@/features/lists/params";
import { paginate, type Paged } from "@/lib/list-links";
import { isObjectId } from "@/lib/object-id";
import { escapeRegex } from "@/lib/search";
import { connectToDatabase } from "@/server/db/mongoose";
import { Project } from "./models/project";
import type { ProjectStatus } from "./status";

export interface ProjectListRow {
  id: string;
  code: string;
  title: string;
  organizationName: string | null;
  status: ProjectStatus;
  updatedAt: Date;
}

/** `onlyIds` null = every project; otherwise only those (a developer's assigned projects, even in search). */
export async function listProjectsPaged(
  filters: ProjectListFilters,
  onlyIds: string[] | null,
): Promise<Paged<ProjectListRow>> {
  await connectToDatabase();
  const query: Record<string, unknown> = {};
  if (onlyIds) query._id = { $in: onlyIds.filter(isObjectId) };
  if (filters.status) query.status = filters.status;
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [{ title: pattern }, { code: pattern }];
  }
  const total = await Project.countDocuments(query);
  const { page, pageCount, skip, limit } = paginate(total, filters.page);
  const docs = await Project.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean();
  const names = await organizationNamesById(docs.map((doc) => doc.organizationId));
  return {
    rows: docs.map((doc) => ({
      id: String(doc._id),
      code: doc.code,
      title: doc.title,
      organizationName: names.get(doc.organizationId) ?? null,
      status: doc.status,
      updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
    })),
    total,
    page,
    pageCount,
  };
}
