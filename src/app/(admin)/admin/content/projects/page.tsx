import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagination } from "@/components/lists/pagination";
import { SearchBar } from "@/components/lists/search-bar";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { parseProjectFilters } from "@/features/lists/params";
import { visibleProjectIds } from "@/features/projects/access";
import { projectAccessScope } from "@/features/projects/access-rules";
import { listProjectsPaged } from "@/features/projects/list-service";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, PROJECT_STATUS_TONE } from "@/features/projects/status";
import { formatDateUtc } from "@/lib/format";
import { requireStaff } from "@/server/auth/session";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff("/admin/projects");
  const scope = projectAccessScope(user.role);
  if (scope === "none") notFound();

  const filters = parseProjectFilters(await searchParams);
  // The list is filtered by the server: a developer's search can never reach a project they aren't assigned to.
  const ids = await visibleProjectIds(user);
  const list = await listProjectsPaged(filters, ids);
  const filtered = Boolean(filters.q || filters.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Delivery"
        title={scope === "assigned" ? "Your projects" : "Projects"}
        description={
          scope === "assigned"
            ? "The projects you're assigned to."
            : "Projects are created by converting an accepted proposal."
        }
      />

      <SearchBar
        basePath="/admin/projects"
        q={filters.q}
        placeholder="Title or reference"
        hasFilters={filtered}
        selects={[
          {
            name: "status",
            label: "Status",
            value: filters.status,
            allLabel: "Any status",
            options: PROJECT_STATUSES.map((value) => ({ value, label: PROJECT_STATUS_LABELS[value] })),
          },
        ]}
      />

      <Card>
        {list.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={
                filtered
                  ? "No projects match"
                  : scope === "assigned"
                    ? "No projects assigned to you yet"
                    : "No projects yet"
              }
              description={
                filtered
                  ? "Try a different search or filter."
                  : scope === "assigned"
                    ? "A project manager can add you to a project's team."
                    : "When a client accepts a proposal, open it and choose “Convert to project”."
              }
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
              {list.rows.map((project) => (
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

      <Pagination
        basePath="/admin/projects"
        params={{ q: filters.q, status: filters.status }}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        noun={["project", "projects"]}
      />
    </div>
  );
}
