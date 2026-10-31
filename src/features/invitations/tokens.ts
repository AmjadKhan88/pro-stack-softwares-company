import { createHash, randomBytes } from "node:crypto";

/** 256 bits of randomness, URL-safe. Only its SHA-256 hash is stored, so a database leak exposes no usable links. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
