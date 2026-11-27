import { parseRoom } from "./contract";
import type { RealtimeClaims } from "./token";

/** May this ticket join this room? A person's own room, or a project listed in their ticket. Nothing else. */
export function canJoin(claims: RealtimeClaims, room: unknown): boolean {
  const parsed = parseRoom(room);
  if (!parsed) return false;
  if (parsed.type === "user") return parsed.id === claims.sub;
  return claims.projects === "all" || claims.projects.includes(parsed.id);
}
