import { FolderOpen } from "lucide-react";
import { FileList } from "@/components/files/file-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { listClientFiles } from "@/features/files/service";
import type { FileView } from "@/features/files/types";
import { requireClientContext } from "@/features/organizations/context";

export const metadata = { title: "Files" };

export default async function PortalFilesPage() {
  // The organization comes from the signed-in account, so a client only ever lists their own files.
  const { organization } = await requireClientContext("/portal/files");

  if (!organization) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Client portal" title="Files" />
        <EmptyState
          icon={<FolderOpen className="size-5" />}
          title="Your account isn't linked to an organization yet"
          description="Please contact the team so they can connect your account to your company's workspace."
        />
      </div>
    );
  }

  const files = await listClientFiles(organization.id);
  const byProject = new Map<string, { title: string; files: FileView[] }>();
  for (const file of files) {
    const group = byProject.get(file.projectId) ?? { title: file.projectTitle ?? "Project", files: [] };
    group.files.push(file);
    byProject.set(file.projectId, group);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={organization.name}
        title="Files"
        description="Documents and images we've shared with you. Downloads are private to you."
      />
      {files.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="size-5" />}
          title="No files shared yet"
          description="When we share a file with you, it will appear here."
        />
      ) : (
        [...byProject.entries()].map(([projectId, group]) => (
          <Card key={projectId}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <FileList files={group.files} audience="client" canManage={false} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
