import Link from "next/link";
import { notFound } from "next/navigation";
import { ProposalStatusActions } from "@/components/admin/proposal-status-actions";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getProposalForStaff } from "@/features/proposals/service";
import {
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_TONE,
  displayStatus,
  isEditable,
} from "@/features/proposals/status";
import { formatDateTimeUtc } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";

export async function generateMetadata() {
  return { title: "Proposal" };
}

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("proposals.manage", `/admin/proposals/${id}`);
  const proposal = await getProposalForStaff(id);
  if (!proposal) notFound();
  const shown = displayStatus(proposal);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Proposal ${proposal.code}`}
        title={proposal.title}
        actions={
          isEditable(proposal.status) ? (
            <Button asChild variant="outline">
              <Link href={`/admin/proposals/${proposal.id}/edit`}>Edit draft</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <ProposalDocument proposal={proposal} />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <StatusPill status={PROPOSAL_STATUS_TONE[shown]}>{PROPOSAL_STATUS_LABELS[shown]}</StatusPill>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Client: </span>
                <Link
                  href={`/admin/clients/${proposal.organizationId}`}
                  className="text-accent font-medium hover:underline"
                >
                  {proposal.organizationName ?? "View organization"}
                </Link>
              </p>
              <p>
                <span className="text-muted-foreground">Lead: </span>
                <Link
                  href={`/admin/leads/${proposal.leadId}`}
                  className="text-accent font-medium hover:underline"
                >
                  Open lead
                </Link>
              </p>
              <p className="tabular-nums">
                <span className="text-muted-foreground">Created by: </span>
                {proposal.createdByEmail}
              </p>
              {proposal.sentAt ? (
                <p className="tabular-nums">
                  <span className="text-muted-foreground">Sent: </span>
                  {formatDateTimeUtc(proposal.sentAt)}
                </p>
              ) : null}
              {proposal.expiresAt ? (
                <p className="tabular-nums">
                  <span className="text-muted-foreground">Open until: </span>
                  {formatDateTimeUtc(proposal.expiresAt)}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ProposalStatusActions
                proposalId={proposal.id}
                status={proposal.status}
                organizationName={proposal.organizationName}
              />
            </CardContent>
          </Card>

          {proposal.status === "accepted" && proposal.acceptedBy ? (
            <Card>
              <CardHeader>
                <CardTitle>Accepted</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-relaxed">
                <p>
                  Accepted by <strong>{proposal.acceptedBy.name}</strong> ({proposal.acceptedBy.email}) on{" "}
                  <span className="tabular-nums">
                    {proposal.acceptedAt ? formatDateTimeUtc(proposal.acceptedAt) : ""}
                  </span>
                  .
                </p>
                <p className="text-muted-foreground">
                  Next: turn this into a project (coming in the next step).
                </p>
              </CardContent>
            </Card>
          ) : null}

          {proposal.status === "declined" && proposal.declinedBy ? (
            <Card>
              <CardHeader>
                <CardTitle>Declined</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-relaxed">
                <p>
                  Declined by <strong>{proposal.declinedBy.name}</strong> ({proposal.declinedBy.email}) on{" "}
                  <span className="tabular-nums">
                    {proposal.declinedAt ? formatDateTimeUtc(proposal.declinedAt) : ""}
                  </span>
                  .
                </p>
                {proposal.declineReason ? (
                  <p className="bg-surface-muted rounded-lg p-3 whitespace-pre-wrap">
                    {proposal.declineReason}
                  </p>
                ) : (
                  <p className="text-muted-foreground">No reason given.</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
