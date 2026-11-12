import { notFound, redirect } from "next/navigation";
import { ProposalForm } from "@/components/admin/proposal-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { minorToInput } from "@/features/proposals/money";
import { getProposalForStaff } from "@/features/proposals/service";
import { isEditable } from "@/features/proposals/status";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "Edit proposal" };

export default async function EditProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("proposals.manage", `/admin/proposals/${id}/edit`);
  const proposal = await getProposalForStaff(id);
  if (!proposal) notFound();
  // Content is frozen once sent, so only drafts have an edit screen.
  if (!isEditable(proposal.status)) redirect(`/admin/proposals/${proposal.id}`);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Proposal ${proposal.code}`} title="Edit draft" />
      <Card>
        <CardContent className="py-5">
          <ProposalForm
            mode="edit"
            targetId={proposal.id}
            defaults={{
              title: proposal.title,
              summary: proposal.summary,
              scope: proposal.scope,
              deliverables: proposal.deliverables.join("\n"),
              assumptions: proposal.assumptions.join("\n"),
              exclusions: proposal.exclusions.join("\n"),
              timelineSummary: proposal.timelineSummary,
              estimatedWeeks: String(proposal.estimatedWeeks),
              currency: proposal.currency,
              totalAmount: minorToInput(proposal.totalMinor),
              paymentTerms: proposal.paymentTerms,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
