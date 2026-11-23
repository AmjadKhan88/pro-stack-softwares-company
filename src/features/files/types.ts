export interface FileView {
  id: string;
  projectId: string;
  projectTitle: string | null;
  deliverableId: string | null;
  deliverableTitle: string | null;
  filename: string;
  format: string;
  bytes: number;
  clientVisible: boolean;
  status: "active" | "archived";
  uploadedByEmail: string;
  createdAt: Date;
}

export type FileUploadRequestResult =
  | { ok: true; upload: { url: string; fields: Record<string, string>; publicId: string } }
  | { ok: false; message: string };

export type FileFinalizeResult = { ok: true; fileId: string } | { ok: false; message: string };

export type FileActionState =
  { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

export const initialFileActionState: FileActionState = { status: "idle" };
