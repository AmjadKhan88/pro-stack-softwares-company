// SHARED between the website and the live service. This file exists, byte for byte, in both:
//   src/lib/realtime/contract.ts  and  apps/realtime/src/contract.ts
// A test keeps them identical. Only built-in Node features may be used here.

export const REALTIME_EVENTS = ["notification.created", "message.created"] as const;
export type RealtimeEventName = (typeof REALTIME_EVENTS)[number];

export interface RealtimeMessage {
  room: string;
  event: RealtimeEventName;
  data: Record<string, string>;
}

const OBJECT_ID = /^[a-f0-9]{24}$/;

export function isId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID.test(value);
}

export const userRoom = (userId: string): string => `user:${userId}`;
export const projectRoom = (projectId: string): string => `project:${projectId}`;

export type ParsedRoom = { type: "user" | "project"; id: string };

export function parseRoom(room: unknown): ParsedRoom | null {
  if (typeof room !== "string") return null;
  const match = /^(user|project):([a-f0-9]{24})$/.exec(room);
  const type = match?.[1];
  const id = match?.[2];
  if ((type !== "user" && type !== "project") || !id) return null;
  return { type, id };
}

/**
 * The only data an event may carry: a few ids. Anything else is dropped, so private details
 * can never travel through the live service even by mistake. Returns null when the data is not valid.
 */
export function cleanEventData(event: string, data: unknown): Record<string, string> | null {
  if (typeof data !== "object" || data === null) return null;
  const raw = data as Record<string, unknown>;
  if (event === "notification.created") {
    if (!isId(raw.id) || typeof raw.kind !== "string" || !/^[a-z_]{1,40}$/.test(raw.kind)) return null;
    return { id: raw.id, kind: raw.kind };
  }
  if (event === "message.created") {
    return isId(raw.projectId) ? { projectId: raw.projectId } : null;
  }
  return null;
}
