import Link from "next/link";
import { CreateOrganizationForm } from "@/components/admin/create-organization-form";
import { Pagination } from "@/components/lists/pagination";
import { SearchBar } from "@/components/lists/search-bar";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { parseOrganizationFilters } from "@/features/lists/params";
import { listOrganizationsPaged } from "@/features/organizations/list-service";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("clients.manage", "/admin/clients");
  const filters = parseOrganizationFilters(await searchParams);
  const list = await listOrganizationsPaged(filters);
  const filtered = Boolean(filters.q || filters.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clients"
        title="Client organizations"
        description="Each client account belongs to one organization and only ever sees that organization's work."
      />

      <Card>
        <CardHeader>
          <CardTitle>New organization</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateOrganizationForm />
        </CardContent>
      </Card>

      <SearchBar
        basePath="/admin/clients"
        q={filters.q}
        placeholder="Name or contact email"
        hasFilters={filtered}
        selects={[
          {
            name: "status",
            label: "Status",
            value: filters.status,
            allLabel: "Any status",
            options: [
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
      />

      <Card>
        {list.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={filtered ? "No organizations match" : "No organizations yet"}
              description={
                filtered
                  ? "Try a different search or filter."
                  : "Create one above, then invite the client's people to it from Users & roles."
              }
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th>Members</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((organization) => (
                <tr key={organization.id}>
                  <Td className="font-medium">
                    <Link href={`/admin/clients/${organization.id}`} className="hover:underline">
                      {organization.name}
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">{organization.contactEmail ?? "—"}</Td>
                  <Td className="tabular-nums">{organization.memberCount}</Td>
                  <Td>
                    <StatusPill status={organization.status === "active" ? "live" : "archived"}>
                      {organization.status}
                    </StatusPill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Pagination
        basePath="/admin/clients"
        params={{ q: filters.q, status: filters.status }}
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        noun={["organization", "organizations"]}
      />
    </div>
  );
}
