export type MessageState =
  | { status: "idle" }
  | { status: "success"; sent: number }
  | { status: "error"; message: string; body?: string };

export const initialMessageState: MessageState = { status: "idle" };

export interface MessageView {
  id: string;
  authorName: string;
  authorType: "client" | "staff";
  body: string;
  createdAt: Date;
  /** True when the person looking wrote it. */
  mine: boolean;
}

export interface ConversationRow {
  projectId: string;
  projectTitle: string;
  organizationName: string | null;
  count: number;
  lastAt: Date;
  lastAuthorType: "client" | "staff";
}
