import { getPublicEnv } from "./env";

export function getSiteUrl(): string {
  return getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

/** Search engines are blocked unless NEXT_PUBLIC_ALLOW_INDEXING=true (set it only at real launch). */
export function isIndexingAllowed(): boolean {
  return getPublicEnv().NEXT_PUBLIC_ALLOW_INDEXING === "true";
}
