import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { listAuditLogs } from "@/features/audit/service";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "Audit log" };

const labels: Record<string, string> = {
  "owner.bootstrapped": "Owner account created",
  "invitation.created": "Invitation created",
  "invitation.revoked": "Invitation revoked",
  "invitation.accepted": "Invitation accepted",
};

function formatTime(date: Date) {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export default async function AuditLogsPage() {
  await requirePermission("audit.read", "/admin/audit-logs");
  const rows = await listAuditLogs();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Audit log"
        description="Who did what, and when. Showing the 100 most recent privileged actions."
      />
      <Card>
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nothing recorded yet"
              description="Privileged actions, such as sending an invitation, appear here."
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
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap tabular-nums">{formatTime(row.createdAt)}</Td>
                  <Td>{labels[row.action] ?? row.action}</Td>
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
    </div>
  );
}
