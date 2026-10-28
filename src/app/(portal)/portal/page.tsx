import { FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireClient } from "@/server/auth/session";

export const metadata = { title: "Overview" };

export default async function PortalHomePage() {
  await requireClient("/portal"); // layouts do not re-run on client navigation, so every page checks too
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client portal"
        title="Your projects"
        description="Track milestones, review deliverables and message the team here once the portal is live."
      />
      <EmptyState
        icon={<FolderOpen className="size-5" />}
        title="No projects yet"
        description="Projects shared with your organisation will appear here after your account is invited (Phase 3 and Phase 4)."
      />
    </div>
  );
}
