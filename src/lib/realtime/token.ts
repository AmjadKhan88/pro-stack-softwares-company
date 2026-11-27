// SHARED between the website and the live service (identical in both; a test keeps them so).
// The website signs a short-lived ticket; the live service checks it. Only built-in Node features are used.
import { createHmac, timingSafeEqual } from "node:crypto";
import { isId } from "./contract";

export interface RealtimeClaims {
  /** The signed-in person's id. */
  sub: string;
  /** Project conversations this person may follow, or "all" for staff who can see every project. */
  projects: string[] | "all";
  iat: number;
  exp: number;
}

export const TOKEN_TTL_SECONDS = 15 * 60;
export const MAX_PROJECTS = 200;
const MAX_TOKEN_LENGTH = 12_000;

export function signRealtimeToken(
  claims: { sub: string; projects: string[] | "all" },
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): { token: string; expiresAt: number } {
  if (secret.length < 32) throw new Error("The realtime token secret must be at least 32 characters");
  const full: RealtimeClaims = {
    sub: claims.sub,
    projects: claims.projects === "all" ? "all" : claims.projects.slice(0, MAX_PROJECTS),
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return { token: `${payload}.${signature}`, expiresAt: full.exp };
}

/** Returns the claims only for a genuine, unexpired ticket made with this secret. Anything else is null. */
export function verifyRealtimeToken(
  token: unknown,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): RealtimeClaims | null {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_TOKEN_LENGTH ||
    secret.length < 32
  )
    return null;
  const parts = token.split(".");
  const payload = parts[0];
  const signature = parts[1];
  if (parts.length !== 2 || !payload || !signature) return null;

  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const { sub, projects, iat, exp } = raw as Record<string, unknown>;
  if (!isId(sub) || typeof iat !== "number" || typeof exp !== "number") return null;
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return null;
  if (exp <= nowSeconds || iat > nowSeconds + 60 || exp - iat > TOKEN_TTL_SECONDS) return null;

  if (projects === "all") return { sub, projects: "all", iat, exp };
  if (!Array.isArray(projects) || projects.length > MAX_PROJECTS || !projects.every(isId)) return null;
  return { sub, projects: projects as string[], iat, exp };
}
