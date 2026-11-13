import Link from "next/link";
import { Building2, FolderOpen } from "lucide-react";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireClientContext } from "@/features/organizations/context";
import { listClientProjects } from "@/features/projects/service";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_TONE } from "@/features/projects/status";

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

  const projects = (await listClientProjects(organization.id)).slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={organization.name}
        title="Your projects"
        description="Track milestones and deliverables here, and review any proposals we've sent you."
        actions={
          <Link href="/portal/proposals" className="text-accent text-sm font-medium hover:underline">
            View proposals →
          </Link>
        }
      />
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
