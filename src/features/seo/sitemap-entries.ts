const STATIC_PATHS = ["/", "/services", "/work", "/process", "/about", "/faq", "/contact"];

interface Publishable {
  slug: string;
  isDemo: boolean;
}

/** Sample (demo) detail pages are never listed. Only real, published content reaches the sitemap. */
export function buildSitemapEntries({
  siteUrl,
  services,
  caseStudies,
}: {
  siteUrl: string;
  services: Publishable[];
  caseStudies: Publishable[];
}): { url: string }[] {
  const paths = [
    ...STATIC_PATHS,
    ...services.filter((s) => !s.isDemo).map((s) => `/services/${s.slug}`),
    ...caseStudies.filter((c) => !c.isDemo).map((c) => `/work/${c.slug}`),
  ];
  return paths.map((path) => ({ url: `${siteUrl}${path}` }));
}
