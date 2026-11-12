import Link from "next/link";
import { notFound } from "next/navigation";
import { ProposalForm } from "@/components/admin/proposal-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getLeadDetail } from "@/features/leads/admin-service";
import { budgetLabels, projectTypeLabels, timeframeLabels } from "@/features/leads/schema";
import { isObjectId } from "@/lib/object-id";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "New proposal" };

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  await requirePermission("proposals.manage", "/admin/proposals/new");
  const { lead: leadId } = await searchParams;
  const lead = isObjectId(leadId) ? await getLeadDetail(leadId) : null;
  if (!lead) notFound();

  const eligible = lead.status === "qualified" && Boolean(lead.organizationId);
  if (!eligible) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Proposals" title="New proposal" />
        <Card>
          <CardContent className="space-y-3 py-5 text-sm leading-relaxed">
            <p>
              A proposal can only be written for a <strong>qualified</strong> lead that already has its client
              organization.
            </p>
            <Link href={`/admin/leads/${lead.id}`} className="text-accent font-medium hover:underline">
              Back to the lead
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Lead ${lead.referenceCode}`}
        title="New proposal"
        description={`For ${lead.company ?? lead.name}. It stays a draft until you send it.`}
      />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardContent className="py-5">
            <ProposalForm
              mode="create"
              targetId={lead.id}
              defaults={{ title: `Proposal for ${lead.company ?? lead.name}`, currency: "USD" }}
            />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Their inquiry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Project: </span>
              {projectTypeLabels[lead.projectType]}
            </p>
            <p>
              <span className="text-muted-foreground">Budget: </span>
              {lead.budgetRange ? budgetLabels[lead.budgetRange] : "Not given"}
            </p>
            <p>
              <span className="text-muted-foreground">Timeframe: </span>
              {lead.timeframe ? timeframeLabels[lead.timeframe] : "Not given"}
            </p>
            <p className="bg-surface-muted rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
              {lead.message}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
