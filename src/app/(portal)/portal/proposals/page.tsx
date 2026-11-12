import Link from "next/link";
import { FileText } from "lucide-react";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireClientContext } from "@/features/organizations/context";
import { formatMoney } from "@/features/proposals/money";
import { listClientProposals } from "@/features/proposals/service";
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_TONE, displayStatus } from "@/features/proposals/status";
import { formatDateUtc } from "@/lib/format";

export const metadata = { title: "Proposals" };

export default async function PortalProposalsPage() {
  // The organization comes from the signed-in account, so a client only ever lists their own proposals.
  const { organization } = await requireClientContext("/portal/proposals");

  if (!organization) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Client portal" title="Proposals" />
        <EmptyState
          icon={<FileText className="size-5" />}
          title="Your account isn't linked to an organization yet"
          description="Please contact the team so they can connect your account to your company's workspace."
        />
      </div>
    );
  }

  const proposals = await listClientProposals(organization.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={organization.name}
        title="Proposals"
        description="Proposals we've sent you. Open one to read it and respond."
      />
      {proposals.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="No proposals yet"
          description="When we send you a proposal, it will appear here and we'll email you."
        />
      ) : (
        <ul className="space-y-3">
          {proposals.map((proposal) => {
            const shown = displayStatus(proposal);
            return (
              <li key={proposal.id}>
                <Card className="hover:border-muted-foreground transition-colors">
                  <Link
                    href={`/portal/proposals/${proposal.id}`}
                    className="focus-visible:ring-accent/25 flex flex-wrap items-center justify-between gap-4 rounded-xl p-5 focus-visible:ring-4 focus-visible:outline-none"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold">{proposal.title}</p>
                      <p className="text-muted-foreground font-mono text-xs">{proposal.code}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="tabular-nums">
                        {formatMoney(proposal.totalMinor, proposal.currency)}
                      </span>
                      {shown === "sent" && proposal.expiresAt ? (
                        <span className="text-muted-foreground tabular-nums">
                          Open until {formatDateUtc(proposal.expiresAt)}
                        </span>
                      ) : null}
                      <StatusPill status={PROPOSAL_STATUS_TONE[shown]}>
                        {PROPOSAL_STATUS_LABELS[shown]}
                      </StatusPill>
                    </div>
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
