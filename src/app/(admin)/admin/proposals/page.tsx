import Link from "next/link";
import { Pagination } from "@/components/lists/pagination";
import { SearchBar } from "@/components/lists/search-bar";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { parseProposalFilters } from "@/features/lists/params";
import { formatMoney } from "@/features/proposals/money";
import { listProposalsPaged } from "@/features/proposals/list-service";
import {
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_TONE,
  displayStatus,
} from "@/features/proposals/status";
import { formatDateUtc } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "Proposals" };

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("proposals.manage", "/admin/proposals");
  const filters = parseProposalFilters(await searchParams);
  const list = await listProposalsPaged(filters);
  const filtered = Boolean(filters.q || filters.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clients"
        title="Proposals"
        description="Write a proposal from a qualified lead. Open the lead and choose “Write a proposal”."
      />

      <SearchBar
        basePath="/admin/proposals"
        q={filters.q}
        placeholder="Title or reference"
        hasFilters={filtered}
        selects={[
          {
            name: "status",
            label: "Status",
            value: filters.status,
            allLabel: "Any status",
            options: PROPOSAL_STATUSES.map((value) => ({
              value,
              label: `${PROPOSAL_STATUS_LABELS[value]} (${list.counts[value]})`,
            })),
          },
        ]}
      />

      <Card>
        {list.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={filtered ? "No proposals match" : "No proposals yet"}
              description={
                filtered
                  ? "Try a different search or filter."
                  : "Proposals appear here once you write one from a qualified lead."
              }
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Proposal</Th>
                <Th>Client</Th>
                <Th>Status</Th>
                <Th>Total</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((proposal) => {
                const shown = displayStatus(proposal);
                return (
                  <tr key={proposal.id}>
                    <Td className="font-mono text-xs whitespace-nowrap">{proposal.code}</Td>
                    <Td>
                      <Link href={`/admin/proposals/${proposal.id}`} className="font-medium hover:underline">
                        {proposal.title}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">{proposal.organizationName ?? "—"}</Td>
                    <Td>
                      <StatusPill status={PROPOSAL_STATUS_TONE[shown]}>
                        {PROPOSAL_STATUS_LABELS[shown]}
                      </StatusPill>
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {formatMoney(proposal.totalMinor, proposal.currency)}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">{formatDateUtc(proposal.updatedAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Pagination
        basePath="/admin/proposals"
        params={{ q: filters.q, status: filters.status }}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        noun={["proposal", "proposals"]}
      />
    </div>
  );
}
