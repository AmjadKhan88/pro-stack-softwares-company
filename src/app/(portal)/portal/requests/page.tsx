import Link from "next/link";
import { Inbox } from "lucide-react";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { clientRequestStatus, listClientRequests } from "@/features/leads/request-service";
import { projectTypeLabels } from "@/features/leads/schema";
import { requireClientContext } from "@/features/organizations/context";
import { formatDateUtc } from "@/lib/format";

export const metadata = { title: "Requests" };

export default async function PortalRequestsPage() {
  // The organization comes from the signed-in account, so a client only ever lists their own requests.
  const { organization } = await requireClientContext("/portal/requests");

  if (!organization) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Client portal" title="Requests" />
        <EmptyState
          icon={<Inbox className="size-5" />}
          title="Your account isn't linked to an organization yet"
          description="Please contact the team so they can connect your account to your company's workspace."
        />
      </div>
    );
  }

  const requests = await listClientRequests(organization.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={organization.name}
        title="Requests"
        description="Ask us for a new project and follow what happens to it."
        actions={
          <Button asChild variant="accent">
            <Link href="/portal/requests/new">New request</Link>
          </Button>
        }
      />
      {requests.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-5" />}
          title="No requests yet"
          description="Need something new built? Send us a request and we'll get back to you."
        />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => {
            const status = clientRequestStatus(request.status);
            return (
              <li key={request.referenceCode}>
                <Card>
                  <CardContent className="space-y-2 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs">{request.referenceCode}</span>
                        <span className="font-medium">{projectTypeLabels[request.projectType]}</span>
                      </div>
                      <StatusPill status={status.tone}>{status.label}</StatusPill>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{request.preview}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      Sent {formatDateUtc(request.createdAt)} · {status.note}
                    </p>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
