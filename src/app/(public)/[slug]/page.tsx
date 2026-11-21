import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CmsPageView } from "@/components/public-site/cms-page-view";
import { isOverridablePageSlug } from "@/features/cms/reserved";
import { isValidSlug } from "@/features/cms/slug";
import { getPage, getPageRedirect, getPublishedPages } from "@/features/content/repository";
import { cmsPageMetadata } from "@/features/content/metadata";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  // "about" and "process" are built-in routes that a page can replace: they are not served from here.
  const slugs = (await getPublishedPages())
    .filter((page) => !isOverridablePageSlug(page.slug))
    .map((page) => ({ slug: page.slug }));
  // Next.js needs at least one known address to check the route at build time.
  return slugs.length > 0 ? slugs : [{ slug: "not-found" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) return {};
  const page = await getPage(slug);
  return page ? cmsPageMetadata(page) : {};
}

export default async function CmsPageRoute({ params }: Props) {
  const { slug } = await params;
  // Anything that can't be a page address is a 404 straight away, without touching the database.
  if (!isValidSlug(slug)) notFound();
  const page = await getPage(slug);
  if (!page) {
    const target = await getPageRedirect(slug);
    if (target) permanentRedirect(`/${target}`);
    notFound();
  }
  return <CmsPageView page={page} />;
}
