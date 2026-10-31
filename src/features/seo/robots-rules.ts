import type { MetadataRoute } from "next";

// robots.txt is a crawling hint, not security. Real protection is server-side auth (Phase 3).
export const PRIVATE_PATHS = [
  "/admin",
  "/portal",
  "/api/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/two-factor",
  "/continue",
  "/security",
  "/no-access",
  "/design-system",
  "/accept-invite",
];

export function buildRobots({
  allowIndexing,
  siteUrl,
}: {
  allowIndexing: boolean;
  siteUrl: string;
}): MetadataRoute.Robots {
  if (!allowIndexing) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
