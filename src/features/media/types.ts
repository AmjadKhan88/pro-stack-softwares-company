export interface MediaView {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
  filename: string;
  format: string;
  bytes: number;
}

export interface MediaRow extends MediaView {
  status: "active" | "archived";
  usage: number;
  uploadedByEmail: string;
  createdAt: Date;
}

export type UploadRequestResult =
  | { ok: true; upload: { url: string; fields: Record<string, string>; publicId: string } }
  | { ok: false; message: string };

export type FinalizeResult = { ok: true; assetId: string } | { ok: false; message: string };

export type PickerResult =
  { ok: true; assets: MediaView[]; page: number; pageCount: number } | { ok: false; message: string };

export type MediaActionState =
  { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

export const initialMediaActionState: MediaActionState = { status: "idle" };
