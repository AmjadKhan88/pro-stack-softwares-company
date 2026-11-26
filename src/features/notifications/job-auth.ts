import { timingSafeEqual } from "node:crypto";

/** True only when the request carries the exact secret. Without a configured secret, nobody is allowed. */
export function isAuthorizedJob(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 24 || !header) return false;
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
