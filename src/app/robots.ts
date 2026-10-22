import type { MetadataRoute } from "next";
import { buildRobots } from "@/features/seo/robots-rules";
import { getSiteUrl, isIndexingAllowed } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return buildRobots({ allowIndexing: isIndexingAllowed(), siteUrl: getSiteUrl() });
}
