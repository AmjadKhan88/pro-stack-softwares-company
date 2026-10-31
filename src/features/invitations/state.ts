export type InviteState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<"email" | "role", string>> };

export type AcceptState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<"name" | "password" | "confirm", string>>;
    };

export const initialInviteState: InviteState = { status: "idle" };
export const initialAcceptState: AcceptState = { status: "idle" };
