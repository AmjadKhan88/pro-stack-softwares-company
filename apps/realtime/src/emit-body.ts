import {
  REALTIME_EVENTS,
  cleanEventData,
  parseRoom,
  type RealtimeEventName,
  type RealtimeMessage,
} from "./contract";

export const MAX_EMIT_BODY_BYTES = 20_000;
export const MAX_EMIT_EVENTS = 50;

/**
 * Checks what the website asks the service to send. Everything must be exactly right or the whole request is
 * refused: a known event, sent to the right kind of room, carrying only ids.
 */
export function parseEmitBody(body: unknown): RealtimeMessage[] | null {
  if (typeof body !== "object" || body === null) return null;
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EMIT_EVENTS) return null;

  const result: RealtimeMessage[] = [];
  for (const item of events) {
    if (typeof item !== "object" || item === null) return null;
    const { room, event, data } = item as Record<string, unknown>;
    const parsedRoom = parseRoom(room);
    if (!parsedRoom || typeof room !== "string") return null;
    if (typeof event !== "string" || !(REALTIME_EVENTS as readonly string[]).includes(event)) return null;
    // A notification goes to one person's room; a message goes to a project room.
    if (parsedRoom.type !== (event === "notification.created" ? "user" : "project")) return null;
    const clean = cleanEventData(event, data);
    if (!clean) return null;
    result.push({ room, event: event as RealtimeEventName, data: clean });
  }
  return result;
}
