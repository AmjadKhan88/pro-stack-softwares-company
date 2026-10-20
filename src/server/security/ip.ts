import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getServerEnv } from "@/lib/env";

function getSalt(): string {
  const { IP_HASH_SALT, NODE_ENV } = getServerEnv();
  if (IP_HASH_SALT) return IP_HASH_SALT;
  if (NODE_ENV === "production") {
    throw new Error("IP_HASH_SALT is not set. Add a random 32+ character value (see ENVIRONMENT.md).");
  }
  return "development-only-salt-not-for-production!";
}

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(getSalt()).update(value).digest("hex");
}

/** Works behind a trusted proxy that sets x-forwarded-for (e.g. Vercel). Stores only a salted hash. */
export async function getClientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return hashIdentifier(ip);
}
