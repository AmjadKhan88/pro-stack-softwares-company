import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { AUDIT_LABELS } from "@/features/audit/labels";
import { dashboardSections, hasAnySection } from "@/features/dashboard/sections";
import { getAdminSummary } from "@/features/dashboard/service";
import { LEAD_STATUS_LABELS, LEAD_STATUS_TONE } from "@/features/leads/pipeline";
import { visibleProjectIds } from "@/features/projects/access";
import { formatDateTimeUtc, formatDateUtc } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";

export const metadata = { title: "Overview" };

export default async function AdminHomePage() {
  const user = await requireStaff("/admin"); // layouts do not re-run on client navigation, so every page checks too
  const sections = dashboardSections(user.role);

  if (!hasAnySection(sections)) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Admin" title={`Welcome, ${user.name}`} />
        <EmptyState
          icon={<LayoutDashboard className="size-5" />}
          title="Nothing to summarise here yet"
          description="Use the menu to open the areas available to your role."
        />
      </div>
    );
  }

  // Developers get counts for their assigned projects only: the same rule as the project list.
  const projectIds = sections.projects ? await visibleProjectIds(user) : [];
  const summary = await getAdminSummary({ sections, projectIds });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title={`Welcome, ${user.name}`}
        description="What needs attention right now. Click a number to open the list behind it."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.leads ? (
          <>
            <StatCard
              label="New leads"
              value={summary.leads.newCount}
              href="/admin/leads?status=new"
              attention
            />
            <StatCard
              label="Qualified leads"
              value={summary.leads.qualifiedCount}
              href="/admin/leads?status=qualified"
            />
          </>
        ) : null}
        {summary.proposals ? (
          <>
            <StatCard
              label="Proposals awaiting client"
              value={summary.proposals.awaitingClient}
              href="/admin/proposals?status=sent"
            />
            <StatCard
              label="Ready to convert"
              value={summary.proposals.readyToConvert}
              hint="Accepted, no project yet"
              href="/admin/proposals?status=accepted"
              attention
            />
          </>
        ) : null}
        {summary.projects ? (
          <>
            <StatCard
              label="Active projects"
              value={summary.projects.active}
              href="/admin/projects?status=active"
            />
            <StatCard
              label="Waiting on client review"
              value={summary.projects.waitingOnClient}
              hint="Deliverables in review"
            />
            <StatCard
              label="Changes requested"
              value={summary.projects.changesRequested}
              hint="Clients asked for changes"
              attention
            />
          </>
        ) : null}
        {summary.organizations !== null ? (
          <StatCard label="Client organizations" value={summary.organizations} href="/admin/clients" />
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {summary.leads ? (
          <Card>
            <CardHeader>
              <CardTitle>Latest leads</CardTitle>
              <Link href="/admin/leads" className="text-accent text-sm font-medium hover:underline">
                All leads
              </Link>
            </CardHeader>
            <CardContent>
              {summary.leads.recent.length === 0 ? (
                <p className="text-muted-foreground text-sm">No leads yet.</p>
              ) : (
                <ul className="space-y-3">
                  {summary.leads.recent.map((lead) => (
                    <li key={lead.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <Link href={`/admin/leads/${lead.id}`} className="font-medium hover:underline">
                          {lead.name}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {lead.company ? `${lead.company} · ` : ""}
                          {formatDateUtc(lead.createdAt)}
                        </p>
                      </div>
                      <StatusPill status={LEAD_STATUS_TONE[lead.status]}>
                        {LEAD_STATUS_LABELS[lead.status]}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        {summary.activity ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <Link href="/admin/audit-logs" className="text-accent text-sm font-medium hover:underline">
                Full log
              </Link>
            </CardHeader>
            <CardContent>
              {summary.activity.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nothing recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {summary.activity.map((row) => (
                    <li key={row.id} className="text-sm">
                      <p className="font-medium">{AUDIT_LABELS[row.action] ?? row.action}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {row.actorEmail ?? "System"} · {formatDateTimeUtc(row.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
