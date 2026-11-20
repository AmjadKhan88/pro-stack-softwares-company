"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeUploadAction, requestUploadAction } from "@/features/media/actions";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  formatBytes,
  validateUploadRequest,
} from "@/features/media/rules";
import { Button } from "@/components/ui/button";

type Status =
  | { kind: "idle" }
  | { kind: "working"; step: string; percent?: number }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

/** Sends the file straight to Cloudinary (never through our server), with progress. */
function postToCloudinary(
  url: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let detail = "";
      try {
        detail = (JSON.parse(xhr.responseText) as { error?: { message?: string } }).error?.message ?? "";
      } catch {
        /* keep the generic message */
      }
      reject(
        new Error(
          detail ? `The image service refused the file: ${detail}` : "The image service refused the file.",
        ),
      );
    };
    xhr.onerror = () =>
      reject(new Error("The upload couldn't reach the image service. Check your connection and try again."));
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    body.append("file", file);
    xhr.send(body);
  });
}

export function UploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const working = status.kind === "working";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setStatus({ kind: "error", message: "Choose an image first." });
    const problem = validateUploadRequest({ filename: file.name, mimeType: file.type, size: file.size });
    if (problem) return setStatus({ kind: "error", message: problem });
    if (alt.trim().length < 3) {
      return setStatus({
        kind: "error",
        message: "Describe the image in a few words, for people who can't see it.",
      });
    }

    setStatus({ kind: "working", step: "Preparing…" });
    const signed = await requestUploadAction({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      altText: alt,
    });
    if (!signed.ok) return setStatus({ kind: "error", message: signed.message });

    try {
      setStatus({ kind: "working", step: "Uploading…", percent: 0 });
      await postToCloudinary(signed.upload.url, signed.upload.fields, file, (percent) =>
        setStatus({ kind: "working", step: "Uploading…", percent }),
      );
      setStatus({ kind: "working", step: "Checking the image…" });
      const done = await finalizeUploadAction({ publicId: signed.upload.publicId });
      if (!done.ok) return setStatus({ kind: "error", message: done.message });
      formRef.current?.reset();
      setFile(null);
      setAlt("");
      setStatus({ kind: "done", message: "Uploaded. It's now in the library." });
      router.refresh();
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "The upload failed." });
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={working} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="media-file" className="mb-1.5 block text-[13px] font-medium">
            Image <span className="text-muted-foreground font-normal">(required)</span>
          </label>
          <input
            id="media-file"
            type="file"
            accept={ALLOWED_MIME_TYPES.join(",")}
            disabled={working}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="border-border bg-surface block w-full rounded-lg border p-2 text-sm"
          />
          <p className="text-muted-foreground mt-1.5 text-xs">
            JPEG, PNG or WebP, up to {formatBytes(MAX_UPLOAD_BYTES)}.
          </p>
        </div>
        <div>
          <label htmlFor="media-alt" className="mb-1.5 block text-[13px] font-medium">
            Description <span className="text-muted-foreground font-normal">(required)</span>
          </label>
          <input
            id="media-alt"
            type="text"
            value={alt}
            maxLength={200}
            disabled={working}
            onChange={(event) => setAlt(event.target.value)}
            className="border-border bg-surface focus-visible:ring-accent/25 h-10 w-full rounded-lg border px-3 text-sm focus-visible:ring-4 focus-visible:outline-none"
          />
          <p className="text-muted-foreground mt-1.5 text-xs">
            For people who can&apos;t see the image (alt text).
          </p>
        </div>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">
        Everything in this library is public on the internet. Don&apos;t upload confidential client files
        here.
      </p>

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

      <Button type="submit" variant="accent" disabled={working}>
        {working ? "Working…" : "Upload image"}
      </Button>
    </form>
  );
}
