import { FileArchiveForm, FileVisibilityForm } from "@/components/admin/files/file-row-forms";
import { StatusPill } from "@/components/ui/badge";
import type { FileView } from "@/features/files/types";
import { formatBytes } from "@/features/media/rules";
import { formatDateUtc } from "@/lib/format";

export function FileList({
  files,
  audience,
  canManage,
  emptyText = "No files yet.",
}: {
  files: FileView[];
  audience: "staff" | "client";
  canManage: boolean;
  emptyText?: string;
}) {
  if (files.length === 0) return <p className="text-muted-foreground text-sm">{emptyText}</p>;

  return (
    <ul className="divide-border divide-y">
      {files.map((file) => (
        <li key={file.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-medium" title={file.filename}>
              {file.filename}
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {file.format.toUpperCase()} · {formatBytes(file.bytes)} · {formatDateUtc(file.createdAt)}
              {file.deliverableTitle ? ` · ${file.deliverableTitle}` : ""}
              {file.projectTitle ? ` · ${file.projectTitle}` : ""}
            </p>
            {audience === "staff" ? (
              <span className="flex flex-wrap gap-2">
                <StatusPill status={file.clientVisible ? "live" : "draft"}>
                  {file.clientVisible ? "Visible to client" : "Hidden from client"}
                </StatusPill>
                {file.status === "archived" ? <StatusPill status="archived">Archived</StatusPill> : null}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {file.status === "active" || audience === "staff" ? (
              <a
                href={`/api/files/${file.id}`}
                aria-label={`Download ${file.filename}`}
                className="text-accent text-sm font-medium hover:underline"
              >
                Download
              </a>
            ) : null}
            {canManage ? (
              <>
                {file.status === "active" ? (
                  <FileVisibilityForm fileId={file.id} visible={file.clientVisible} />
                ) : null}
                <FileArchiveForm fileId={file.id} archived={file.status === "archived"} />
              </>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
