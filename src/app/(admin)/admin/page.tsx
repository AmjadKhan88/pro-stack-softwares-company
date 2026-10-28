import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/server/auth/session";

export const metadata = { title: "Overview" };

export default async function AdminHomePage() {
  await requireStaff("/admin"); // layouts do not re-run on client navigation, so every page checks too
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        description="Leads, projects and content management will be summarised here."
      />
      <EmptyState
        icon={<LayoutDashboard className="size-5" />}
        title="Nothing to show yet"
        description="Metrics and activity appear here once leads, clients and projects exist (Phase 4 onwards). No placeholder numbers are shown."
      />
    </div>
  );
}
