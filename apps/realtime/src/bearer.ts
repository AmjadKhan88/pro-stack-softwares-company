import { timingSafeEqual } from "node:crypto";

/** True only when the header carries exactly this secret. A missing or short secret allows nobody. */
export function isBearerMatch(header: string | null, secret: string): boolean {
  if (secret.length < 32 || !header) return false;
  const match = /^Bearer (.+)$/.exec(header);
  const given = Buffer.from(match?.[1] ?? "");
  const expected = Buffer.from(secret);
  return Boolean(match) && given.length === expected.length && timingSafeEqual(given, expected);
}
