import Link from "next/link";
import { CreateOrganizationForm } from "@/components/admin/create-organization-form";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { listOrganizations } from "@/features/organizations/service";
import { requirePermission } from "@/server/auth/session";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  await requirePermission("clients.manage", "/admin/clients");
  const organizations = await listOrganizations();

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

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        {organizations.length === 0 ? (
          <CardContent>
            <EmptyState
              title="No organizations yet"
              description="Create one above, then invite the client's people to it from Users & roles."
            />
          </CardContent>
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
              {organizations.map((organization) => (
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
    </div>
  );
}
