import Link from "next/link";
import { Inbox } from "lucide-react";
import { RequestForm } from "@/components/portal/request-form";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireClientContext } from "@/features/organizations/context";

export const metadata = { title: "New request" };

export default async function NewRequestPage() {
  const { organization } = await requireClientContext("/portal/requests/new");

  if (!organization) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Client portal" title="New request" />
        <EmptyState
          icon={<Inbox className="size-5" />}
          title="Your account isn't linked to an organization yet"
          description="Please contact the team so they can connect your account to your company's workspace."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/portal/requests" className="text-accent text-sm font-medium hover:underline">
        ← All requests
      </Link>
      <PageHeader
        eyebrow={organization.name}
        title="Request a new project"
        description="Tell us what you'd like built. We'll review it and reply by email."
      />
      <Card>
        <CardContent className="py-5">
          <RequestForm />
        </CardContent>
      </Card>
    </div>
  );
}
