"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeFileUploadAction, requestFileUploadAction } from "@/features/files/actions";
import { FILE_MIME_TYPES, validateFileRequest } from "@/features/files/rules";
import { postToCloudinary } from "@/lib/post-to-cloudinary";
import { Button } from "@/components/ui/button";

type Status =
  | { kind: "idle" }
  | { kind: "working"; step: string; percent?: number }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

const field =
  "border-border bg-surface focus-visible:ring-accent/25 w-full rounded-lg border px-3 text-sm focus-visible:ring-4 focus-visible:outline-none";

export function FileUploadForm({
  projectId,
  deliverables,
}: {
  projectId: string;
  deliverables: { id: string; title: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [deliverableId, setDeliverableId] = useState("");
  const [clientVisible, setClientVisible] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const working = status.kind === "working";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setStatus({ kind: "error", message: "Choose a file first." });
    const problem = validateFileRequest({ filename: file.name, mimeType: file.type, size: file.size });
    if (problem) return setStatus({ kind: "error", message: problem });

    setStatus({ kind: "working", step: "Preparing…" });
    const signed = await requestFileUploadAction({
      projectId,
      ...(deliverableId ? { deliverableId } : {}),
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      clientVisible,
    });
    if (!signed.ok) return setStatus({ kind: "error", message: signed.message });

    try {
      setStatus({ kind: "working", step: "Uploading…", percent: 0 });
      await postToCloudinary(signed.upload.url, signed.upload.fields, file, (percent) =>
        setStatus({ kind: "working", step: "Uploading…", percent }),
      );
      setStatus({ kind: "working", step: "Checking the file…" });
      const done = await finalizeFileUploadAction({ publicId: signed.upload.publicId });
      if (!done.ok) return setStatus({ kind: "error", message: done.message });
      formRef.current?.reset();
      setFile(null);
      setDeliverableId("");
      setClientVisible(false);
      setStatus({ kind: "done", message: "Uploaded." });
      router.refresh();
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "The upload failed." });
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      aria-busy={working}
      className="border-border space-y-4 rounded-lg border p-4"
    >
      <p className="text-sm font-medium">Add a file</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="file-input" className="mb-1.5 block text-[13px] font-medium">
            File
          </label>
          <input
            id="file-input"
            type="file"
            accept={FILE_MIME_TYPES.join(",")}
            disabled={working}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="border-border bg-surface block w-full rounded-lg border p-2 text-sm"
          />
          <p className="text-muted-foreground mt-1.5 text-xs">PDF, PNG, JPEG or WebP, up to 10 MB.</p>
        </div>
        <div>
          <label htmlFor="file-deliverable" className="mb-1.5 block text-[13px] font-medium">
            Attach to a deliverable (optional)
          </label>
          <select
            id="file-deliverable"
            value={deliverableId}
            disabled={working}
            onChange={(event) => setDeliverableId(event.target.value)}
            className={`${field} h-10`}
          >
            <option value="">None: a general project file</option>
            {deliverables.map((deliverable) => (
              <option key={deliverable.id} value={deliverable.id}>
                {deliverable.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm leading-relaxed">
        <input
          type="checkbox"
          checked={clientVisible}
          disabled={working}
          onChange={(event) => setClientVisible(event.target.checked)}
          className="mt-1"
        />
        <span>Show to the client. If you leave this unticked, only staff can download it.</span>
      </label>

      <div aria-live="polite" className="text-sm">
        {status.kind === "working" ? (
          <p>
            {status.step}
            {status.percent !== undefined ? ` ${status.percent}%` : ""}
          </p>
        ) : null}
        {status.kind === "error" ? (
          <p role="alert" className="text-danger font-medium">
            {status.message}
          </p>
        ) : null}
        {status.kind === "done" ? <p className="text-success font-medium">{status.message}</p> : null}
      </div>

      <Button type="submit" variant="accent" size="sm" disabled={working}>
        {working ? "Working…" : "Upload file"}
      </Button>
    </form>
  );
}
