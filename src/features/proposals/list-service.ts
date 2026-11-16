import "server-only";
import { organizationNamesById } from "@/features/organizations/names";
import type { ProposalListFilters } from "@/features/lists/params";
import { paginate, type Paged } from "@/lib/list-links";
import { escapeRegex } from "@/lib/search";
import { connectToDatabase } from "@/server/db/mongoose";
import type { Currency } from "./money";
import { Proposal } from "./models/proposal";
import { PROPOSAL_STATUSES, type ProposalStatus } from "./status";

export interface ProposalListRow {
  id: string;
  code: string;
  title: string;
  organizationName: string | null;
  status: ProposalStatus;
  expiresAt: Date | null;
  totalMinor: number;
  currency: Currency;
  updatedAt: Date;
}

export interface ProposalPage extends Paged<ProposalListRow> {
  counts: Record<ProposalStatus, number>;
}

export async function listProposalsPaged(filters: ProposalListFilters): Promise<ProposalPage> {
  await connectToDatabase();
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q), "i");
    query.$or = [{ title: pattern }, { code: pattern }];
  }
  const [total, grouped] = await Promise.all([
    Proposal.countDocuments(query),
    Proposal.aggregate<{ _id: ProposalStatus; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  const { page, pageCount, skip, limit } = paginate(total, filters.page);
  const docs = await Proposal.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean();
  const names = await organizationNamesById(docs.map((doc) => doc.organizationId));

  const counts = Object.fromEntries(PROPOSAL_STATUSES.map((status) => [status, 0])) as Record<
    ProposalStatus,
    number
  >;
  for (const row of grouped) if (row._id in counts) counts[row._id] += row.count;

  return {
    rows: docs.map((doc) => ({
      id: String(doc._id),
      code: doc.code,
      title: doc.title,
      organizationName: names.get(doc.organizationId) ?? null,
      status: doc.status,
      expiresAt: doc.expiresAt ?? null,
      totalMinor: doc.totalMinor,
      currency: doc.currency,
      updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
    })),
    total,
    page,
    pageCount,
    counts,
  };
}
