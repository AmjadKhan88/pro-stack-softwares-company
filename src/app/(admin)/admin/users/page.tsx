import { InviteForm } from "@/components/admin/invite-form";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { revokeInvite } from "@/features/invitations/actions";
import { ROLE_LABELS, describeInviteState, invitableRolesFor } from "@/features/invitations/rules";
import { listInvitations, listUsers } from "@/features/invitations/service";
import { requirePermission } from "@/server/auth/session";
import { isRole } from "@/server/policies/permissions";

export const metadata = { title: "Users & roles" };

const pillFor = { pending: "review", expired: "archived", accepted: "live", revoked: "blocked" } as const;

function formatDate(date: Date) {
  return `${date.toISOString().slice(0, 10)} UTC`;
}

export default async function UsersPage() {
  const actor = await requirePermission("users.manage", "/admin/users");
  const [users, invitations] = await Promise.all([listUsers(), listInvitations()]);
  const roles = invitableRolesFor(actor.role);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Users & roles"
        description="Accounts are created by invitation only. Role changes for existing users arrive in a later phase."
      />

      <Card>
        <CardHeader>
          <CardTitle>Invite someone</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm roles={roles} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
        </CardHeader>
        {invitations.length === 0 ? (
          <CardContent>
            <EmptyState
              title="No invitations yet"
              description="Invitations you send will appear here with their status."
            />
          </CardContent>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Expires</Th>
                <Th>Invited by</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invite) => {
                const state = describeInviteState(invite);
                return (
                  <tr key={invite.id}>
                    <Td>{invite.email}</Td>
                    <Td>{ROLE_LABELS[invite.role]}</Td>
                    <Td>
                      <StatusPill status={pillFor[state]}>{state}</StatusPill>
                    </Td>
                    <Td className="tabular-nums">{formatDate(invite.expiresAt)}</Td>
                    <Td className="text-muted-foreground">{invite.invitedByEmail}</Td>
                    <Td>
                      {state === "pending" ? (
                        <form action={revokeInvite}>
                          <input type="hidden" name="id" value={invite.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Revoke
                          </Button>
                        </form>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Two-factor</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <Td className="font-medium">{user.name}</Td>
                <Td>{user.email}</Td>
                <Td>{isRole(user.role) ? ROLE_LABELS[user.role] : "No access"}</Td>
                <Td>
                  <StatusPill status={user.twoFactorEnabled ? "live" : "draft"}>
                    {user.twoFactorEnabled ? "On" : "Off"}
                  </StatusPill>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
