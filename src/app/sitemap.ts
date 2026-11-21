import type { MetadataRoute } from "next";
import { getArticles, getCaseStudies, getPublishedPages, getServices } from "@/features/content/repository";
import { buildSitemapEntries } from "@/features/seo/sitemap-entries";
import { getSiteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, caseStudies, articles, pages] = await Promise.all([
    getServices(),
    getCaseStudies(),
    getArticles(),
    getPublishedPages(),
  ]);
  return buildSitemapEntries({ siteUrl: getSiteUrl(), services, caseStudies, articles, pages });
}
