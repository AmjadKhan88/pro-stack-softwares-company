import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { getOrganization, listMembers } from "@/features/organizations/service";
import { requirePermission } from "@/server/auth/session";

export async function generateMetadata() {
  return { title: "Organization" };
}

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("clients.manage", `/admin/clients/${id}`);
  const organization = await getOrganization(id);
  if (!organization) notFound();
  const members = await listMembers(organization.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client organization"
        title={organization.name}
        description={organization.contactEmail ?? "No contact email on file."}
        actions={
          <Button asChild variant="accent">
            <Link href={`/admin/users?org=${organization.id}`}>Invite a client</Link>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusPill status={organization.status === "active" ? "live" : "archived"}>
          {organization.status}
        </StatusPill>
        <span className="text-muted-foreground">Created by {organization.createdByEmail}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        {members.length === 0 ? (
          <CardContent>
            <EmptyState
              title="No members yet"
              description="Invite the client's people. Each one sees only this organization's work."
            />
          </CardContent>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId}>
                  <Td className="font-medium">{member.name}</Td>
                  <Td>{member.email}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
