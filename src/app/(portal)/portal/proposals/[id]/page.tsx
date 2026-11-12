import Link from "next/link";
import { notFound } from "next/navigation";
import { ProposalResponseForm } from "@/components/portal/proposal-response-form";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClientContext } from "@/features/organizations/context";
import { getClientProposal } from "@/features/proposals/service";
import {
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_TONE,
  canRespond,
  displayStatus,
} from "@/features/proposals/status";
import { formatDateTimeUtc } from "@/lib/format";

export async function generateMetadata() {
  return { title: "Proposal" };
}

export default async function PortalProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireClientContext(`/portal/proposals/${id}`);
  if (!organization) notFound();

  // Scoped to the signed-in client's organization: another organization's proposal id finds nothing (404).
  const proposal = await getClientProposal(organization.id, id);
  if (!proposal) notFound();
  const shown = displayStatus(proposal);

  return (
    <div className="space-y-6">
      <Link href="/portal/proposals" className="text-accent text-sm font-medium hover:underline">
        ← All proposals
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <ProposalDocument proposal={proposal} />

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Your response</CardTitle>
            <StatusPill status={PROPOSAL_STATUS_TONE[shown]}>{PROPOSAL_STATUS_LABELS[shown]}</StatusPill>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            {canRespond(proposal) ? (
              <>
                {proposal.expiresAt ? (
                  <p className="tabular-nums">
                    This proposal is open until {formatDateTimeUtc(proposal.expiresAt)}.
                  </p>
                ) : null}
                <ProposalResponseForm proposalId={proposal.id} organizationName={organization.name} />
              </>
            ) : shown === "accepted" ? (
              <p>
                Accepted by <strong>{proposal.acceptedBy?.name}</strong>
                {proposal.acceptedAt ? ` on ${formatDateTimeUtc(proposal.acceptedAt)}` : ""}. Our team will be
                in touch about the next steps.
              </p>
            ) : shown === "declined" ? (
              <p>
                You declined this proposal
                {proposal.declinedAt ? ` on ${formatDateTimeUtc(proposal.declinedAt)}` : ""}.
              </p>
            ) : (
              <p>This proposal has expired. Please contact us if you&apos;d still like to go ahead.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
