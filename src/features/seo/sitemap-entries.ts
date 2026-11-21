const STATIC_PATHS = ["/", "/services", "/work", "/process", "/about", "/faq", "/contact"];

interface Publishable {
  slug: string;
  isDemo: boolean;
  seo?: { noindex: boolean };
}

interface Indexable {
  slug: string;
  seo?: { noindex: boolean };
}

/** Sample (demo) detail pages and pages hidden from search engines are never listed. Only real, published content is. */
export function buildSitemapEntries({
  siteUrl,
  services,
  caseStudies,
  articles = [],
  pages = [],
}: {
  siteUrl: string;
  services: Publishable[];
  caseStudies: Publishable[];
  articles?: Indexable[];
  pages?: Indexable[];
}): { url: string }[] {
  const listedArticles = articles.filter((a) => !a.seo?.noindex);
  const paths = [
    ...STATIC_PATHS,
    ...services.filter((s) => !s.isDemo && !s.seo?.noindex).map((s) => `/services/${s.slug}`),
    ...caseStudies.filter((c) => !c.isDemo && !c.seo?.noindex).map((c) => `/work/${c.slug}`),
    ...(listedArticles.length > 0 ? ["/insights"] : []),
    ...listedArticles.map((a) => `/insights/${a.slug}`),
    // "about" and "process" are already listed above; a page that replaces them keeps the same address.
    ...pages.filter((p) => !p.seo?.noindex).map((p) => `/${p.slug}`),
  ];
  return [...new Set(paths)].map((path) => ({ url: `${siteUrl}${path}` }));
}
