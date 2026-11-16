import Link from "next/link";
import { Building2, FolderOpen } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getClientSummary } from "@/features/dashboard/service";
import { requireClientContext } from "@/features/organizations/context";
import { listClientProjects } from "@/features/projects/service";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_TONE } from "@/features/projects/status";
import { formatDateUtc } from "@/lib/format";

export const metadata = { title: "Overview" };

export default async function PortalHomePage() {
  // The organization comes from the signed-in account, never from the URL.
  const { organization } = await requireClientContext("/portal");

  if (!organization) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Client portal" title="Your projects" />
        <EmptyState
          icon={<Building2 className="size-5" />}
          title="Your account isn't linked to an organization yet"
          description="Please contact the team so they can connect your account to your company's workspace."
        />
      </div>
    );
  }

  const [summary, allProjects] = await Promise.all([
    getClientSummary(organization.id),
    listClientProjects(organization.id),
  ]);
  const projects = allProjects.slice(0, 5);
  const needsAttention = summary.proposalsToReview.length + summary.deliverablesToReview.length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={organization.name}
        title="Your projects"
        description="Track milestones and deliverables, and review what we've sent you."
        actions={
          <Button asChild variant="outline">
            <Link href="/portal/requests/new">Request a new project</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active projects" value={summary.activeProjects} href="/portal/projects" />
        <StatCard
          label="Proposals to review"
          value={summary.proposalsToReview.length}
          href="/portal/proposals"
          attention
        />
        <StatCard
          label="Deliverables to review"
          value={summary.deliverablesToReview.length}
          hint="Ready for your approval"
          attention
        />
      </div>

      {needsAttention > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Needs your attention</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {summary.proposalsToReview.map((proposal) => (
                <li key={proposal.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/portal/proposals/${proposal.id}`} className="font-medium hover:underline">
                    Proposal: {proposal.title}
                  </Link>
                  {proposal.expiresAt ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      Open until {formatDateUtc(proposal.expiresAt)}
                    </span>
                  ) : null}
                </li>
              ))}
              {summary.deliverablesToReview.map((deliverable) => (
                <li key={deliverable.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/portal/projects/${deliverable.projectId}`}
                    className="font-medium hover:underline"
                  >
                    Review: {deliverable.title}
                  </Link>
                  <span className="text-muted-foreground text-xs">{deliverable.projectTitle}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="size-5" />}
          title="No projects yet"
          description="Projects shared with your organization will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Card className="hover:border-muted-foreground transition-colors">
                <Link
                  href={`/portal/projects/${project.id}`}
                  className="focus-visible:ring-accent/25 flex flex-wrap items-center justify-between gap-4 rounded-xl p-5 focus-visible:ring-4 focus-visible:outline-none"
                >
                  <span className="font-semibold">{project.title}</span>
                  <StatusPill status={PROJECT_STATUS_TONE[project.status]}>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </StatusPill>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
