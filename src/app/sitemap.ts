import type { MetadataRoute } from "next";
import { getCaseStudies, getServices } from "@/features/content/repository";
import { buildSitemapEntries } from "@/features/seo/sitemap-entries";
import { getSiteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, caseStudies] = await Promise.all([getServices(), getCaseStudies()]);
  return buildSitemapEntries({ siteUrl: getSiteUrl(), services, caseStudies });
}
