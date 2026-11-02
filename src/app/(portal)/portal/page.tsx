import { Building2, FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireClientContext } from "@/features/organizations/context";

export const metadata = { title: "Overview" };

export default async function PortalHomePage() {
  // The organization comes from the signed-in account, never from the URL.
  const { organization } = await requireClientContext("/portal");

  if (!organization) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Client portal" title="Your projects" />
        <EmptyState
          icon={<Building2 className="size-5" />}
          title="Your account isn't linked to an organization yet"
          description="Please contact the team so they can connect your account to your company's workspace."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={organization.name}
        title="Your projects"
        description="Track milestones, review deliverables and message the team here once the portal is live."
      />
      <EmptyState
        icon={<FolderOpen className="size-5" />}
        title="No projects yet"
        description="Projects shared with your organization will appear here."
      />
    </div>
  );
}
