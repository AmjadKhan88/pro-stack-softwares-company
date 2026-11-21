import type { Metadata } from "next";
import { ogImageMeta } from "@/features/media/urls";
import type { CmsPage } from "./types";

export function cmsPageMetadata(page: CmsPage): Metadata {
  const title = page.seo?.title ?? page.title;
  const description = page.seo?.description ?? (page.summary || undefined);
  const share = ogImageMeta(page.seo?.ogImage);
  return {
    title,
    description,
    alternates: { canonical: `/${page.slug}` },
    robots: page.seo?.noindex ? { index: false, follow: true } : undefined,
    ...(share
      ? {
          openGraph: { type: "website", title, description, url: `/${page.slug}`, images: share },
          twitter: {
            card: "summary_large_image" as const,
            title,
            description,
            images: share.map((i) => i.url),
          },
        }
      : {}),
  };
}
