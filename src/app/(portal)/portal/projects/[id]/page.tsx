import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireClientContext } from "@/features/organizations/context";
import { getClientProject } from "@/features/projects/service";
import {
  ITEM_STATUS_LABELS,
  ITEM_STATUS_TONE,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONE,
} from "@/features/projects/status";
import { formatDateUtc } from "@/lib/format";

export async function generateMetadata() {
  return { title: "Project" };
}

export default async function PortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireClientContext(`/portal/projects/${id}`);
  if (!organization) notFound();

  // Scoped to the signed-in client's organization: another organization's project id finds nothing (404).
  const detail = await getClientProject(organization.id, id);
  if (!detail) notFound();
  const { project, milestones, deliverables, progress } = detail;

  return (
    <div className="space-y-6">
      <Link href="/portal/projects" className="text-accent text-sm font-medium hover:underline">
        ← All projects
      </Link>

      <header className="space-y-2">
        <p className="text-muted-foreground font-mono text-xs">{project.code}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{project.title}</h1>
          <StatusPill status={PROJECT_STATUS_TONE[project.status]}>
            {PROJECT_STATUS_LABELS[project.status]}
          </StatusPill>
        </div>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">{project.summary}</p>
      </header>

      {progress.total > 0 ? (
        <Card>
          <CardContent className="space-y-2 py-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground tabular-nums">
                {progress.done} of {progress.total} milestones done
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
              aria-label="Project progress"
              className="bg-surface-muted h-2 overflow-hidden rounded-full"
            >
              <div className="bg-success h-full rounded-full" style={{ width: `${progress.percent}%` }} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            {milestones.length === 0 ? (
              <EmptyState
                title="No milestones shared yet"
                description="We'll add them here as the project plan takes shape."
              />
            ) : (
              <ul className="space-y-4">
                {milestones.map((milestone) => (
                  <li key={milestone.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{milestone.title}</span>
                      <StatusPill status={ITEM_STATUS_TONE[milestone.status]}>
                        {ITEM_STATUS_LABELS[milestone.status]}
                      </StatusPill>
                    </div>
                    {milestone.description ? (
                      <p className="text-muted-foreground text-sm leading-relaxed">{milestone.description}</p>
                    ) : null}
                    {milestone.dueDate ? (
                      <p className="text-muted-foreground text-xs tabular-nums">
                        Due {formatDateUtc(milestone.dueDate)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deliverables</CardTitle>
          </CardHeader>
          <CardContent>
            {deliverables.length === 0 ? (
              <EmptyState
                title="No deliverables shared yet"
                description="What we hand over will be listed here."
              />
            ) : (
              <ul className="space-y-4">
                {deliverables.map((deliverable) => (
                  <li key={deliverable.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{deliverable.title}</span>
                      <StatusPill status={ITEM_STATUS_TONE[deliverable.status]}>
                        {ITEM_STATUS_LABELS[deliverable.status]}
                      </StatusPill>
                    </div>
                    {deliverable.description ? (
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {deliverable.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
