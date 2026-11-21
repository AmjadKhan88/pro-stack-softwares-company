// Page addresses live at the top level (/privacy), so they must never shadow a route the website already has.
const RESERVED = new Set([
  "services",
  "work",
  "process",
  "about",
  "faq",
  "contact",
  "insights",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "verify-email",
  "two-factor",
  "continue",
  "no-access",
  "accept-invite",
  "security",
  "portal",
  "admin",
  "api",
  "book-a-call",
  "team",
  "sitemap",
  "robots",
  "favicon",
  "icon",
  "apple-icon",
  "manifest",
  "opengraph-image",
  "twitter-image",
  "_next",
  "not-found",
]);

/** A page published at one of these addresses REPLACES the built-in page. */
export const OVERRIDABLE_PAGE_SLUGS = ["about", "process"] as const;

export function isOverridablePageSlug(slug: string): boolean {
  return (OVERRIDABLE_PAGE_SLUGS as readonly string[]).includes(slug);
}

export function isAllowedPageSlug(slug: string): boolean {
  return isOverridablePageSlug(slug) || !RESERVED.has(slug);
}
