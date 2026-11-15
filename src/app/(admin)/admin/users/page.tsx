import Link from "next/link";
import { InviteForm } from "@/components/admin/invite-form";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { revokeInvite } from "@/features/invitations/actions";
import { ROLE_LABELS, describeInviteState, invitableRolesFor } from "@/features/invitations/rules";
import { listInvitations } from "@/features/invitations/service";
import { listOrganizations } from "@/features/organizations/service";
import { accountsHref, parseAccountFilters } from "@/features/users/schema";
import { listAccounts } from "@/features/users/service";
import { formatDateUtc } from "@/lib/format";
import { isObjectId } from "@/lib/object-id";
import { requirePermission } from "@/server/auth/session";
import { ROLES, isRole } from "@/server/policies/permissions";

export const metadata = { title: "Users & roles" };

const pillFor = { pending: "review", expired: "archived", accepted: "live", revoked: "blocked" } as const;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission("users.manage", "/admin/users");
  const params = await searchParams;
  const filters = parseAccountFilters(params);
  const orgParam = Array.isArray(params.org) ? params.org[0] : params.org;

  const [accounts, invitations, organizations] = await Promise.all([
    listAccounts(filters),
    listInvitations(),
    listOrganizations(),
  ]);
  const activeOrganizations = organizations
    .filter((organization) => organization.status === "active")
    .map(({ id, name }) => ({ id, name }));
  const preselected =
    isObjectId(orgParam) && activeOrganizations.some((o) => o.id === orgParam) ? orgParam : undefined;
  const roles = invitableRolesFor(actor.role);
  const filtered = Boolean(filters.q || filters.role || filters.status);

  const input =
    "border-border bg-surface focus-visible:ring-accent/25 h-10 rounded-lg border px-3 text-sm focus-visible:ring-4 focus-visible:outline-none";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Users & roles"
        description="Accounts are created by invitation only. Open an account to change its role or disable it."
      />

      <Card>
        <CardHeader>
          <CardTitle>Invite someone</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm
            roles={roles}
            organizations={activeOrganizations}
            defaultRole={preselected && roles.includes("client") ? "client" : undefined}
            defaultOrganizationId={preselected}
          />
        </CardContent>
      </Card>

      <section aria-labelledby="accounts-heading" className="space-y-4">
        <h2 id="accounts-heading" className="text-lg font-semibold tracking-tight">
          Accounts
        </h2>

        <form method="get" action="/admin/users" role="search" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="account-search" className="mb-1.5 block text-[13px] font-medium">
              Search
            </label>
            <input
              id="account-search"
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              maxLength={100}
              placeholder="Name or email"
              className={`${input} w-full`}
            />
          </div>
          <div>
            <label htmlFor="account-role" className="mb-1.5 block text-[13px] font-medium">
              Role
            </label>
            <select id="account-role" name="role" defaultValue={filters.role ?? ""} className={input}>
              <option value="">All roles</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="account-status" className="mb-1.5 block text-[13px] font-medium">
              Status
            </label>
            <select id="account-status" name="status" defaultValue={filters.status ?? ""} className={input}>
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-primary text-primary-foreground focus-visible:ring-accent/25 h-10 rounded-lg px-4 text-sm font-medium focus-visible:ring-4 focus-visible:outline-none"
          >
            Search
          </button>
          {filtered ? (
            <Link
              href="/admin/users"
              className="text-accent h-10 content-center text-sm font-medium hover:underline"
            >
              Clear filters
            </Link>
          ) : null}
        </form>

        <Card>
          {accounts.rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={filtered ? "No accounts match" : "No accounts yet"}
                description={
                  filtered
                    ? "Try a different search or filter."
                    : "Invite someone to create the first account."
                }
              />
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Two-factor</Th>
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody>
                {accounts.rows.map((account) => (
                  <tr key={account.id}>
                    <Td className="font-medium">
                      <Link href={`/admin/users/${account.id}`} className="hover:underline">
                        {account.name || "Unnamed"}
                      </Link>
                    </Td>
                    <Td>{account.email}</Td>
                    <Td>{isRole(account.role) ? ROLE_LABELS[account.role] : "No access"}</Td>
                    <Td>
                      <StatusPill status={account.disabled ? "blocked" : "live"}>
                        {account.disabled ? "Disabled" : "Active"}
                      </StatusPill>
                    </Td>
                    <Td>
                      <StatusPill status={account.twoFactorEnabled ? "live" : "draft"}>
                        {account.twoFactorEnabled ? "On" : "Off"}
                      </StatusPill>
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {account.createdAt ? formatDateUtc(account.createdAt) : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {accounts.total > 0 ? (
          <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground tabular-nums">
              Page {accounts.page} of {accounts.pageCount} · {accounts.total}{" "}
              {accounts.total === 1 ? "account" : "accounts"}
            </span>
            <span className="flex gap-4">
              {accounts.page > 1 ? (
                <Link
                  href={accountsHref(filters, { page: accounts.page - 1 })}
                  className="text-accent font-medium hover:underline"
                >
                  ← Previous
                </Link>
              ) : null}
              {accounts.page < accounts.pageCount ? (
                <Link
                  href={accountsHref(filters, { page: accounts.page + 1 })}
                  className="text-accent font-medium hover:underline"
                >
                  Next →
                </Link>
              ) : null}
            </span>
          </nav>
        ) : null}
      </section>

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
                <Th>Organization</Th>
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
                    <Td className="text-muted-foreground">{invite.organizationName ?? "—"}</Td>
                    <Td>
                      <StatusPill status={pillFor[state]}>{state}</StatusPill>
                    </Td>
                    <Td className="tabular-nums">{formatDateUtc(invite.expiresAt)}</Td>
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
    </div>
  );
}
