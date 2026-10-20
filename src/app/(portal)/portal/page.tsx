import { FolderOpen } from "lucide-react";
import { AccessNotice } from "@/components/shared/access-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Overview" };

export default function PortalHomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client portal"
        title="Your projects"
        description="Track milestones, review deliverables and message the team here once the portal is live."
      />
      <AccessNotice area="portal" />
      <EmptyState
        icon={<FolderOpen className="size-5" />}
        title="No projects yet"
        description="Projects shared with your organisation will appear here after your account is invited (Phase 3 and Phase 4)."
      />
    </div>
  );
}
