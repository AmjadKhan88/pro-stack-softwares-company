import { describe, expect, it } from "vitest";
import { getPublicEnv } from "@/lib/env";
import { PRIVATE_PATHS, buildRobots } from "@/features/seo/robots-rules";
import { buildSitemapEntries } from "@/features/seo/sitemap-entries";
import {
  breadcrumbSchema,
  faqSchema,
  organizationSchema,
  serviceSchema,
  websiteSchema,
} from "@/features/seo/structured-data";

const siteUrl = "https://example.com";

describe("sitemap", () => {
  const entries = buildSitemapEntries({
    siteUrl,
    services: [
      { slug: "sample-service", isDemo: true },
      { slug: "real-service", isDemo: false },
    ],
    caseStudies: [{ slug: "sample-study", isDemo: true }],
  });
  const urls = entries.map((e) => e.url);

  it("lists the public pages and real detail pages", () => {
    expect(urls).toContain("https://example.com/");
    expect(urls).toContain("https://example.com/contact");
    expect(urls).toContain("https://example.com/services/real-service");
  });

  it("never lists sample (demo) pages", () => {
    expect(urls).not.toContain("https://example.com/services/sample-service");
    expect(urls).not.toContain("https://example.com/work/sample-study");
  });

  it("never lists private areas and has no duplicates", () => {
    for (const path of PRIVATE_PATHS) expect(urls.some((u) => u.includes(path))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("robots", () => {
  it("blocks everything unless indexing is explicitly allowed", () => {
    expect(buildRobots({ allowIndexing: false, siteUrl })).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
  });

  it("when allowed, hides private paths and points to the sitemap", () => {
    const robots = buildRobots({ allowIndexing: true, siteUrl });
    expect(robots.sitemap).toBe("https://example.com/sitemap.xml");
    const rules = robots.rules as { disallow: string[] };
    for (const path of ["/admin", "/portal", "/api/"]) expect(rules.disallow).toContain(path);
  });

  it("defaults to not allowing indexing", () => {
    expect(getPublicEnv({} as NodeJS.ProcessEnv).NEXT_PUBLIC_ALLOW_INDEXING).toBe("false");
    expect(
      getPublicEnv({ NEXT_PUBLIC_ALLOW_INDEXING: "true" } as unknown as NodeJS.ProcessEnv)
        .NEXT_PUBLIC_ALLOW_INDEXING,
    ).toBe("true");
  });
});

describe("structured data", () => {
  it("organization contains only facts we have", () => {
    const org = organizationSchema(siteUrl);
    expect(org["@type"]).toBe("ProfessionalService");
    expect(org.address.addressLocality).toBe("Peshawar");
    for (const forbidden of ["aggregateRating", "review", "award", "sameAs", "logo"]) {
      expect(org).not.toHaveProperty(forbidden);
    }
  });

  it("website links to the organization", () => {
    expect(websiteSchema(siteUrl).publisher["@id"]).toBe(`${siteUrl}/#organization`);
  });

  it("breadcrumbs are ordered from 1 with absolute URLs", () => {
    const crumbs = breadcrumbSchema(siteUrl, [
      { name: "Home", path: "/" },
      { name: "Services", path: "/services" },
    ]);
    expect(crumbs.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(crumbs.itemListElement[1].item).toBe("https://example.com/services");
  });

  it("service and FAQ schemas map their inputs", () => {
    expect(serviceSchema(siteUrl, { slug: "a", title: "A", description: "d" }).url).toBe(
      "https://example.com/services/a",
    );
    const faq = faqSchema([{ question: "Q?", answer: "A." }]);
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe("A.");
  });
});
