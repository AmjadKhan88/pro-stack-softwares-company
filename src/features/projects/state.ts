export type ProjectActionState =
  { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

export const initialProjectActionState: ProjectActionState = { status: "idle" };
