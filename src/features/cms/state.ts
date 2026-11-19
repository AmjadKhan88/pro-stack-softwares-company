import type { RawForm } from "./schema";

export type ContentFormState =
  | { status: "idle" }
  | { status: "success"; message: string; values: RawForm }
  | { status: "error"; message: string; fieldErrors?: Record<string, string>; values?: RawForm };

export type ContentActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; problems?: string[] };

export const initialContentFormState: ContentFormState = { status: "idle" };
export const initialContentActionState: ContentActionState = { status: "idle" };
