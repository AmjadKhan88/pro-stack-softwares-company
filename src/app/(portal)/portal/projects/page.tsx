import Link from "next/link";
import { Briefcase } from "lucide-react";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireClientContext } from "@/features/organizations/context";
import { listClientProjects } from "@/features/projects/service";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_TONE } from "@/features/projects/status";
import { formatDateUtc } from "@/lib/format";

export const metadata = { title: "Projects" };

export default async function PortalProjectsPage() {
  // The organization comes from the signed-in account, so a client only ever lists their own projects.
  const { organization } = await requireClientContext("/portal/projects");

  if (!organization) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Client portal" title="Projects" />
        <EmptyState
          icon={<Briefcase className="size-5" />}
          title="Your account isn't linked to an organization yet"
          description="Please contact the team so they can connect your account to your company's workspace."
        />
      </div>
    );
  }

  const projects = await listClientProjects(organization.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={organization.name}
        title="Projects"
        description="Follow the progress of your projects."
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="size-5" />}
          title="No projects yet"
          description="Once a proposal is accepted, your project will appear here."
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
                  <div className="space-y-1">
                    <p className="font-semibold">{project.title}</p>
                    <p className="text-muted-foreground font-mono text-xs">{project.code}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground tabular-nums">
                      Updated {formatDateUtc(project.updatedAt)}
                    </span>
                    <StatusPill status={PROJECT_STATUS_TONE[project.status]}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </StatusPill>
                  </div>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
