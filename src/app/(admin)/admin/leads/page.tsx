import Link from "next/link";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { listLeads } from "@/features/leads/admin-service";
import { leadsHref, parseLeadFilters } from "@/features/leads/admin-schema";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_TONE } from "@/features/leads/pipeline";
import { budgetLabels, projectTypeLabels } from "@/features/leads/schema";
import { formatDateUtc } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("leads.read", "/admin/leads");
  const filters = parseLeadFilters(await searchParams);
  const list = await listLeads(filters);
  const allCount = LEAD_STATUSES.reduce((sum, status) => sum + list.counts[status], 0);
  const filtered = Boolean(filters.status || filters.q);

  const chip = "rounded-full border px-3 py-1 text-sm transition-colors";
  const chipIdle = `${chip} border-border bg-surface text-muted-foreground hover:text-foreground`;
  const chipActive = `${chip} border-primary bg-primary text-primary-foreground`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clients"
        title="Leads"
        description="Inquiries from the contact form. Move each one through the pipeline and keep notes as you go."
      />

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <Link
          href={leadsHref(filters, { status: undefined, page: 1 })}
          className={filters.status ? chipIdle : chipActive}
          aria-current={filters.status ? undefined : "true"}
        >
          All <span className="tabular-nums">({allCount})</span>
        </Link>
        {LEAD_STATUSES.map((status) => (
          <Link
            key={status}
            href={leadsHref(filters, { status, page: 1 })}
            className={filters.status === status ? chipActive : chipIdle}
            aria-current={filters.status === status ? "true" : undefined}
          >
            {LEAD_STATUS_LABELS[status]} <span className="tabular-nums">({list.counts[status]})</span>
          </Link>
        ))}
      </nav>

      <form method="get" action="/admin/leads" role="search" className="flex flex-wrap items-end gap-2">
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        <div className="min-w-[240px] flex-1">
          <label htmlFor="lead-search" className="mb-1.5 block text-[13px] font-medium">
            Search
          </label>
          <input
            id="lead-search"
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            maxLength={100}
            placeholder="Name, email, company or reference"
            className="border-border bg-surface focus-visible:ring-accent/25 h-10 w-full rounded-lg border px-3 text-sm focus-visible:ring-4 focus-visible:outline-none"
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground focus-visible:ring-accent/25 h-10 rounded-lg px-4 text-sm font-medium focus-visible:ring-4 focus-visible:outline-none"
        >
          Search
        </button>
        {filtered ? (
          <Link
            href="/admin/leads"
            className="text-accent h-10 content-center text-sm font-medium hover:underline"
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      <Card>
        {list.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={filtered ? "No leads match" : "No leads yet"}
              description={
                filtered
                  ? "Try a different status or search term."
                  : "Inquiries sent through the contact form will appear here."
              }
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Contact</Th>
                <Th>Project</Th>
                <Th>Budget</Th>
                <Th>Status</Th>
                <Th>Received</Th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((lead) => (
                <tr key={lead.id}>
                  <Td className="font-mono text-xs whitespace-nowrap">{lead.referenceCode}</Td>
                  <Td>
                    <Link href={`/admin/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.name}
                    </Link>
                    <div className="text-muted-foreground text-xs">
                      {lead.company ? `${lead.company} · ` : ""}
                      {lead.email}
                    </div>
                  </Td>
                  <Td>{projectTypeLabels[lead.projectType]}</Td>
                  <Td className="whitespace-nowrap">
                    {lead.budgetRange ? budgetLabels[lead.budgetRange] : "—"}
                  </Td>
                  <Td>
                    <StatusPill status={LEAD_STATUS_TONE[lead.status]}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </StatusPill>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatDateUtc(lead.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {list.total > 0 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground tabular-nums">
            Page {list.page} of {list.pageCount} · {list.total} {list.total === 1 ? "lead" : "leads"}
          </span>
          <span className="flex gap-4">
            {list.page > 1 ? (
              <Link
                href={leadsHref(filters, { page: list.page - 1 })}
                className="text-accent font-medium hover:underline"
              >
                ← Previous
              </Link>
            ) : null}
            {list.page < list.pageCount ? (
              <Link
                href={leadsHref(filters, { page: list.page + 1 })}
                className="text-accent font-medium hover:underline"
              >
                Next →
              </Link>
            ) : null}
          </span>
        </nav>
      ) : null}
    </div>
  );
}
