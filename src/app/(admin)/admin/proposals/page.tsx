import Link from "next/link";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { formatMoney } from "@/features/proposals/money";
import { listProposals } from "@/features/proposals/service";
import {
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_TONE,
  displayStatus,
  isProposalStatus,
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
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = isProposalStatus(rawStatus) ? rawStatus : undefined;
  const { rows, counts } = await listProposals({ status });
  const total = PROPOSAL_STATUSES.reduce((sum, s) => sum + counts[s], 0);

  const chip = "rounded-full border px-3 py-1 text-sm transition-colors";
  const chipIdle = `${chip} border-border bg-surface text-muted-foreground hover:text-foreground`;
  const chipActive = `${chip} border-primary bg-primary text-primary-foreground`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clients"
        title="Proposals"
        description="Write a proposal from a qualified lead. Open the lead and choose “Write a proposal”."
      />

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <Link
          href="/admin/proposals"
          className={status ? chipIdle : chipActive}
          aria-current={status ? undefined : "true"}
        >
          All <span className="tabular-nums">({total})</span>
        </Link>
        {PROPOSAL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/proposals?status=${s}`}
            className={status === s ? chipActive : chipIdle}
            aria-current={status === s ? "true" : undefined}
          >
            {PROPOSAL_STATUS_LABELS[s]} <span className="tabular-nums">({counts[s]})</span>
          </Link>
        ))}
      </nav>

      <Card>
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={status ? "No proposals with that status" : "No proposals yet"}
              description="Proposals appear here once you write one from a qualified lead."
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
              {rows.map((proposal) => {
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
    </div>
  );
}
