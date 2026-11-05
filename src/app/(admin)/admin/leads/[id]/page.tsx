import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateOrganizationFromLeadForm } from "@/components/admin/create-organization-from-lead-form";
import { LeadNoteForm } from "@/components/admin/lead-note-form";
import { LeadStatusForm } from "@/components/admin/lead-status-form";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getLeadDetail, listLeadActivity, type ActivityRow } from "@/features/leads/admin-service";
import { LEAD_STATUS_LABELS, LEAD_STATUS_TONE, availableTransitions } from "@/features/leads/pipeline";
import { budgetLabels, projectTypeLabels, timeframeLabels } from "@/features/leads/schema";
import { formatDateTimeUtc } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/permissions";

export async function generateMetadata() {
  return { title: "Lead" };
}

function describeActivity(item: ActivityRow): string {
  if (item.type === "status_change" && item.fromStatus && item.toStatus) {
    return `Status changed from ${LEAD_STATUS_LABELS[item.fromStatus]} to ${LEAD_STATUS_LABELS[item.toStatus]}`;
  }
  if (item.type === "organization_linked") return "Client organization created";
  return "Note";
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("leads.read", `/admin/leads/${id}`);
  const lead = await getLeadDetail(id);
  if (!lead) notFound();

  const activity = await listLeadActivity(lead.id);
  const canManage = can(user.role, "leads.manage");
  const canCreateOrganization = canManage && can(user.role, "clients.manage");
  const options = availableTransitions(lead.status, Boolean(lead.organizationId));
  const needsOrganizationForWin = lead.status === "qualified" && !lead.organizationId;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Lead ${lead.referenceCode}`}
        title={lead.name}
        description={lead.company ?? undefined}
        actions={
          <Link href="/admin/leads" className="text-accent text-sm font-medium hover:underline">
            ← All leads
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inquiry</CardTitle>
              <StatusPill status={LEAD_STATUS_TONE[lead.status]}>
                {LEAD_STATUS_LABELS[lead.status]}
              </StatusPill>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>
                    <a href={`mailto:${lead.email}`} className="text-accent font-medium hover:underline">
                      {lead.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Project type</dt>
                  <dd>{projectTypeLabels[lead.projectType]}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Budget</dt>
                  <dd>{lead.budgetRange ? budgetLabels[lead.budgetRange] : "Not given"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Timeframe</dt>
                  <dd>{lead.timeframe ? timeframeLabels[lead.timeframe] : "Not given"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Received</dt>
                  <dd className="tabular-nums">{formatDateTimeUtc(lead.createdAt)}</dd>
                </div>
              </dl>
              <div>
                <h3 className="text-muted-foreground mb-1.5 text-sm">Message</h3>
                <p className="bg-surface-muted rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {lead.message}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {activity.map((item) => (
                  <li key={item.id} className="text-sm">
                    <p className="font-medium">{describeActivity(item)}</p>
                    {item.body ? (
                      <p className="mt-1 leading-relaxed whitespace-pre-wrap">{item.body}</p>
                    ) : null}
                    <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                      {item.actorEmail} · {formatDateTimeUtc(item.createdAt)}
                    </p>
                  </li>
                ))}
                <li className="text-sm">
                  <p className="font-medium">Inquiry received</p>
                  <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                    Contact form · {formatDateTimeUtc(lead.createdAt)}
                  </p>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canManage && options.length > 0 ? (
                <LeadStatusForm leadId={lead.id} options={options} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  {lead.status === "won"
                    ? "This lead is won. No further changes."
                    : canManage
                      ? "No status changes available."
                      : "You can view this lead but not change it."}
                </p>
              )}
              {canManage && needsOrganizationForWin ? (
                <p className="text-sm leading-relaxed">
                  To mark this lead as <strong>won</strong>, first create its client organization
                  {canCreateOrganization ? "." : ". Ask a project manager or admin to do this."}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client organization</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.organizationId ? (
                can(user.role, "clients.manage") ? (
                  <Link
                    href={`/admin/clients/${lead.organizationId}`}
                    className="text-accent font-medium hover:underline"
                  >
                    {lead.organizationName ?? "View organization"}
                  </Link>
                ) : (
                  <p className="text-sm font-medium">{lead.organizationName ?? "Linked"}</p>
                )
              ) : canCreateOrganization ? (
                <CreateOrganizationFromLeadForm leadId={lead.id} suggestedName={lead.company ?? lead.name} />
              ) : (
                <p className="text-muted-foreground text-sm">Not linked yet.</p>
              )}
            </CardContent>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Add a note</CardTitle>
              </CardHeader>
              <CardContent>
                <LeadNoteForm leadId={lead.id} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
