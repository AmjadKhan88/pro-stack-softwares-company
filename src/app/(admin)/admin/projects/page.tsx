import Link from "next/link";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { listProjects } from "@/features/projects/service";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_TONE } from "@/features/projects/status";
import { formatDateUtc } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  await requirePermission("projects.read.all", "/admin/projects");
  const projects = await listProjects();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        description="Projects are created by converting an accepted proposal."
      />
      <Card>
        {projects.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No projects yet"
              description="When a client accepts a proposal, open it and choose “Convert to project”."
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Project</Th>
                <Th>Client</Th>
                <Th>Status</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <Td className="font-mono text-xs whitespace-nowrap">{project.code}</Td>
                  <Td>
                    <Link href={`/admin/projects/${project.id}`} className="font-medium hover:underline">
                      {project.title}
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">{project.organizationName ?? "—"}</Td>
                  <Td>
                    <StatusPill status={PROJECT_STATUS_TONE[project.status]}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </StatusPill>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatDateUtc(project.updatedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
