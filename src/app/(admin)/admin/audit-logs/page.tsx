import { Pagination } from "@/components/lists/pagination";
import { SearchBar } from "@/components/lists/search-bar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { AUDIT_LABELS } from "@/features/audit/labels";
import { listAuditLogsPaged } from "@/features/audit/list-service";
import { AUDIT_ACTIONS } from "@/features/audit/types";
import { parseAuditFilters } from "@/features/lists/params";
import { formatDateTimeUtc } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "Audit log" };

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("audit.read", "/admin/audit-logs");
  const filters = parseAuditFilters(await searchParams);
  const list = await listAuditLogsPaged(filters);
  const filtered = Boolean(filters.q || filters.action);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Audit log"
        description="Who did what, and when. Every privileged action is recorded here."
      />

      <SearchBar
        basePath="/admin/audit-logs"
        q={filters.q}
        placeholder="Who did it (email)"
        hasFilters={filtered}
        selects={[
          {
            name: "action",
            label: "Action",
            value: filters.action,
            allLabel: "Any action",
            options: AUDIT_ACTIONS.map((value) => ({ value, label: AUDIT_LABELS[value] })),
          },
        ]}
      />

      <Card>
        {list.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={filtered ? "Nothing matches" : "Nothing recorded yet"}
              description={
                filtered
                  ? "Try a different search or action."
                  : "Privileged actions, such as sending an invitation, appear here."
              }
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>By</Th>
                <Th>Target</Th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap tabular-nums">{formatDateTimeUtc(row.createdAt)}</Td>
                  <Td>{AUDIT_LABELS[row.action] ?? row.action}</Td>
                  <Td>{row.actorEmail ?? "System"}</Td>
                  <Td className="text-muted-foreground">
                    {row.targetType ? `${row.targetType} ${row.targetId?.slice(-6) ?? ""}` : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Pagination
        basePath="/admin/audit-logs"
        params={{ q: filters.q, action: filters.action }}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        noun={["entry", "entries"]}
      />
    </div>
  );
}
