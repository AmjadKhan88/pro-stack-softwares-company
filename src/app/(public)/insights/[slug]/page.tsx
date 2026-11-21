import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public-site/breadcrumbs";
import { ArticleBody } from "@/components/public-site/article-body";
import { CtaBand } from "@/components/public-site/cta-band";
import { JsonLd } from "@/components/shared/json-ld";
import { getArticleBySlug, getArticleRedirect, getArticles } from "@/features/content/repository";
import { ogImageMeta } from "@/features/media/urls";
import { articleSchema, breadcrumbSchema } from "@/features/seo/structured-data";
import { getSiteUrl } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = (await getArticles()).map((a) => ({ slug: a.slug }));
  // Next.js needs at least one known address to check the route at build time. Unknown addresses
  // (including ones published later) are rendered on request and then cached.
  return slugs.length > 0 ? slugs : [{ slug: "not-found" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};
  const title = article.seo?.title ?? article.title;
  const description = article.seo?.description ?? article.summary;
  const share = ogImageMeta(article.seo?.ogImage ?? article.image);
  return {
    title,
    description,
    alternates: { canonical: `/insights/${article.slug}` },
    robots: article.seo?.noindex ? { index: false, follow: true } : undefined,
    ...(share
      ? {
          openGraph: { type: "article", title, description, url: `/insights/${article.slug}`, images: share },
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

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) {
    // A renamed article keeps working: send visitors and search engines to its new address.
    const target = await getArticleRedirect(slug);
    if (target) permanentRedirect(`/insights/${target}`);
    notFound();
  }
  const siteUrl = getSiteUrl();
  return (
    <>
      <JsonLd
        data={breadcrumbSchema(siteUrl, [
          { name: "Home", path: "/" },
          { name: "Insights", path: "/insights" },
          { name: article.title, path: `/insights/${article.slug}` },
        ])}
      />
      <JsonLd
        data={articleSchema(siteUrl, {
          slug: article.slug,
          title: article.title,
          summary: article.summary,
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
          author: article.author,
          imageUrl: article.seo?.ogImage?.url ?? article.image?.url,
        })}
      />
      <article className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Insights", href: "/insights" },
            { label: article.title },
          ]}
        />
        <ArticleBody article={article} />
      </article>
      <CtaBand />
    </>
  );
}
