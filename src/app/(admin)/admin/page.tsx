import { LayoutDashboard } from "lucide-react";
import { AccessNotice } from "@/components/shared/access-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Overview" };

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        description="Leads, projects and content management will be summarised here."
      />
      <AccessNotice area="admin" />
      <EmptyState
        icon={<LayoutDashboard className="size-5" />}
        title="Nothing to show yet"
        description="Metrics and activity appear here once leads, clients and projects exist (Phase 4 onwards). No placeholder numbers are shown."
      />
    </div>
  );
}
