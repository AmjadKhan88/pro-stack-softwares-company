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
  "organization.created": "Organization created",
  "organization.member_added": "Member added to organization",
  "lead.status_changed": "Lead status changed",
  "proposal.created": "Proposal created",
  "proposal.sent": "Proposal sent",
  "proposal.withdrawn": "Proposal withdrawn",
  "proposal.reopened": "Proposal reopened",
  "proposal.accepted": "Proposal accepted",
  "proposal.declined": "Proposal declined",
  "project.created": "Project created",
  "project.status_changed": "Project status changed",
  "project.visibility_changed": "Client visibility changed",
  "milestone.created": "Milestone added",
  "milestone.status_changed": "Milestone status changed",
  "deliverable.created": "Deliverable added",
  "deliverable.status_changed": "Deliverable status changed",
  "deliverable.review_submitted": "Deliverable submitted for review",
  "deliverable.review_withdrawn": "Review submission withdrawn",
  "deliverable.review_approved": "Deliverable approved by client",
  "deliverable.review_changes_requested": "Client requested changes",
  "project.member_assigned": "Team member assigned",
  "project.member_removed": "Team member removed",
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
