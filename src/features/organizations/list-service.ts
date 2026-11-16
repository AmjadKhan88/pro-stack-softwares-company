import "server-only";
import type { OrganizationListFilters } from "@/features/lists/params";
import { paginate, type Paged } from "@/lib/list-links";
import { escapeRegex } from "@/lib/search";
import { connectToDatabase } from "@/server/db/mongoose";
import { Organization } from "./models/organization";
import { OrganizationMember } from "./models/organization-member";

export interface OrganizationListRow {
  id: string;
  name: string;
  contactEmail: string | null;
  status: "active" | "archived";
  memberCount: number;
}

export async function listOrganizationsPaged(
  filters: OrganizationListFilters,
): Promise<Paged<OrganizationListRow>> {
  await connectToDatabase();
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [{ name: pattern }, { contactEmail: pattern }];
  }
  const total = await Organization.countDocuments(query);
  const { page, pageCount, skip, limit } = paginate(total, filters.page);
  const docs = await Organization.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  const ids = docs.map((doc) => String(doc._id));
  const counts = ids.length
    ? await OrganizationMember.aggregate<{ _id: string; count: number }>([
        { $match: { organizationId: { $in: ids } } },
        { $group: { _id: "$organizationId", count: { $sum: 1 } } },
      ])
    : [];
  const byOrganization = new Map(counts.map((row) => [row._id, row.count]));
  return {
    rows: docs.map((doc) => ({
      id: String(doc._id),
      name: doc.name,
      contactEmail: doc.contactEmail ?? null,
      status: doc.status,
      memberCount: byOrganization.get(String(doc._id)) ?? 0,
    })),
    total,
    page,
    pageCount,
  };
}
