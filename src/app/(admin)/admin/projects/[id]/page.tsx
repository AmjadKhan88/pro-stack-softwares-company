import Link from "next/link";
import { notFound } from "next/navigation";
import { AddDeliverableForm } from "@/components/admin/add-deliverable-form";
import { AddMilestoneForm } from "@/components/admin/add-milestone-form";
import { ItemStatusForm } from "@/components/admin/item-status-form";
import { ProjectStatusForm } from "@/components/admin/project-status-form";
import { VisibilityForm } from "@/components/admin/visibility-form";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getProjectForStaff } from "@/features/projects/service";
import {
  ITEM_STATUS_LABELS,
  ITEM_STATUS_TONE,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONE,
  isProjectOpen,
} from "@/features/projects/status";
import { formatDateTimeUtc, formatDateUtc } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/permissions";

export async function generateMetadata() {
  return { title: "Project" };
}

function VisibilityPill({ visible }: { visible: boolean }) {
  return (
    <StatusPill status={visible ? "live" : "draft"}>
      {visible ? "Visible to client" : "Internal only"}
    </StatusPill>
  );
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("projects.read.all", `/admin/projects/${id}`);
  const detail = await getProjectForStaff(id);
  if (!detail) notFound();
  const { project, proposalCode, milestones, deliverables } = detail;

  const canManage = can(user.role, "projects.manage");
  const open = isProjectOpen(project.status);
  const milestoneTitles = new Map(milestones.map((m) => [m.id, m.title]));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Project ${project.code}`} title={project.title} description={project.summary} />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {milestones.length === 0 ? (
                <EmptyState
                  title="No milestones yet"
                  description="Add the key points in the project. Clients only see the ones you mark visible."
                />
              ) : (
                <ul className="space-y-4">
                  {milestones.map((milestone) => (
                    <li
                      key={milestone.id}
                      className="border-border space-y-2 border-b pb-4 last:border-b-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{milestone.title}</span>
                        <StatusPill status={ITEM_STATUS_TONE[milestone.status]}>
                          {ITEM_STATUS_LABELS[milestone.status]}
                        </StatusPill>
                        <VisibilityPill visible={milestone.clientVisible} />
                      </div>
                      {milestone.description ? (
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {milestone.description}
                        </p>
                      ) : null}
                      {milestone.dueDate ? (
                        <p className="text-muted-foreground text-xs tabular-nums">
                          Due {formatDateUtc(milestone.dueDate)}
                        </p>
                      ) : null}
                      {canManage && open ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <ItemStatusForm kind="milestone" id={milestone.id} status={milestone.status} />
                          <VisibilityForm
                            kind="milestone"
                            id={milestone.id}
                            visible={milestone.clientVisible}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canManage && open ? <AddMilestoneForm projectId={project.id} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deliverables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {deliverables.length === 0 ? (
                <EmptyState
                  title="No deliverables yet"
                  description="Add what will be handed over. Clients only see the ones you mark visible."
                />
              ) : (
                <ul className="space-y-4">
                  {deliverables.map((deliverable) => (
                    <li
                      key={deliverable.id}
                      className="border-border space-y-2 border-b pb-4 last:border-b-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{deliverable.title}</span>
                        <StatusPill status={ITEM_STATUS_TONE[deliverable.status]}>
                          {ITEM_STATUS_LABELS[deliverable.status]}
                        </StatusPill>
                        <VisibilityPill visible={deliverable.clientVisible} />
                      </div>
                      {deliverable.description ? (
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {deliverable.description}
                        </p>
                      ) : null}
                      {deliverable.milestoneId && milestoneTitles.get(deliverable.milestoneId) ? (
                        <p className="text-muted-foreground text-xs">
                          Milestone: {milestoneTitles.get(deliverable.milestoneId)}
                        </p>
                      ) : null}
                      {canManage && open ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <ItemStatusForm
                            kind="deliverable"
                            id={deliverable.id}
                            status={deliverable.status}
                          />
                          <VisibilityForm
                            kind="deliverable"
                            id={deliverable.id}
                            visible={deliverable.clientVisible}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canManage && open ? (
                <AddDeliverableForm
                  projectId={project.id}
                  milestones={milestones.map((m) => ({ id: m.id, title: m.title }))}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <StatusPill status={PROJECT_STATUS_TONE[project.status]}>
                {PROJECT_STATUS_LABELS[project.status]}
              </StatusPill>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <p>
                  <span className="text-muted-foreground">Client: </span>
                  <Link
                    href={`/admin/clients/${project.organizationId}`}
                    className="text-accent font-medium hover:underline"
                  >
                    {project.organizationName ?? "View organization"}
                  </Link>
                </p>
                <p>
                  <span className="text-muted-foreground">From proposal: </span>
                  <Link
                    href={`/admin/proposals/${project.proposalId}`}
                    className="text-accent font-medium hover:underline"
                  >
                    {proposalCode ?? "Open proposal"}
                  </Link>
                </p>
                <p>
                  <span className="text-muted-foreground">Lead: </span>
                  <Link
                    href={`/admin/leads/${project.leadId}`}
                    className="text-accent font-medium hover:underline"
                  >
                    Open lead
                  </Link>
                </p>
                <p className="tabular-nums">
                  <span className="text-muted-foreground">Created by: </span>
                  {project.createdByEmail}
                </p>
                {project.startedAt ? (
                  <p className="tabular-nums">
                    <span className="text-muted-foreground">Started: </span>
                    {formatDateTimeUtc(project.startedAt)}
                  </p>
                ) : null}
                {project.completedAt ? (
                  <p className="tabular-nums">
                    <span className="text-muted-foreground">Completed: </span>
                    {formatDateTimeUtc(project.completedAt)}
                  </p>
                ) : null}
              </div>
              {canManage ? <ProjectStatusForm projectId={project.id} status={project.status} /> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
