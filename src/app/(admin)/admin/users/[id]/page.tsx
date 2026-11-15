import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountStatusForm } from "@/components/admin/account-status-form";
import { ChangeRoleForm } from "@/components/admin/change-role-form";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ROLE_LABELS } from "@/features/invitations/rules";
import { DENIAL_MESSAGES, allowedRoleOptions, checkDisable, explainRoleChange } from "@/features/users/rules";
import { countOwners, getAccount } from "@/features/users/service";
import { formatDateUtc } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { isRole } from "@/server/policies/permissions";

export async function generateMetadata() {
  return { title: "Account" };
}

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePermission("users.manage", `/admin/users/${id}`);
  const account = await getAccount(id);
  if (!account) notFound();

  const context = {
    actorId: actor.id,
    actorRole: actor.role,
    targetId: account.id,
    targetRole: account.role,
    ownerCount: await countOwners(),
  };
  const roleOptions = allowedRoleOptions(context);
  const roleBlocked = roleOptions.length === 0 ? explainRoleChange(context) : null;
  const statusCheck = checkDisable(context);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title={account.name || "Unnamed"}
        description={account.email}
        actions={
          <Link href="/admin/users" className="text-accent text-sm font-medium hover:underline">
            ← All accounts
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <StatusPill status={account.disabled ? "blocked" : "live"}>
              {account.disabled ? "Disabled" : "Active"}
            </StatusPill>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-medium">
                  {isRole(account.role) ? ROLE_LABELS[account.role] : "No access"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Two-factor</dt>
                <dd>{account.twoFactorEnabled ? "On" : "Off"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email verified</dt>
                <dd>{account.emailVerified ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Joined</dt>
                <dd className="tabular-nums">{account.createdAt ? formatDateUtc(account.createdAt) : "—"}</dd>
              </div>
              {account.role === "client" ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Organization</dt>
                  <dd>
                    {account.organization ? (
                      <Link
                        href={`/admin/clients/${account.organization.id}`}
                        className="text-accent font-medium hover:underline"
                      >
                        {account.organization.name}
                      </Link>
                    ) : (
                      <span>
                        Not linked to an organization yet. Open the organization under{" "}
                        <Link href="/admin/clients" className="text-accent font-medium hover:underline">
                          Clients
                        </Link>{" "}
                        and use &ldquo;Link an existing client account&rdquo;.
                      </span>
                    )}
                  </dd>
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Assigned projects</dt>
                  <dd className="tabular-nums">{account.projectCount}</dd>
                </div>
              )}
              {account.disabled && account.banReason ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Disabled because</dt>
                  <dd>{account.banReason}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {roleOptions.length > 0 ? (
                <>
                  <ChangeRoleForm userId={account.id} options={roleOptions} />
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Moving someone to a role that can&apos;t be on project teams removes them from their
                    projects.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm leading-relaxed">{roleBlocked}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{account.disabled ? "Disabled account" : "Disable account"}</CardTitle>
            </CardHeader>
            <CardContent>
              {statusCheck.ok ? (
                <AccountStatusForm userId={account.id} disabled={account.disabled} />
              ) : (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {DENIAL_MESSAGES[statusCheck.reason]}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
