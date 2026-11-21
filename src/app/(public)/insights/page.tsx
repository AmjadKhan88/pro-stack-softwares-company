import Link from "next/link";
import type { Metadata } from "next";
import { CtaBand } from "@/components/public-site/cta-band";
import { PageIntro } from "@/components/public-site/page-intro";
import { Badge } from "@/components/ui/badge";
import { getArticles } from "@/features/content/repository";
import { formatDateUtc } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const articles = await getArticles();
  return {
    title: "Insights",
    description: "Notes and articles from our software team.",
    alternates: { canonical: "/insights" },
    // An empty page isn't worth indexing yet.
    robots: articles.length === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function InsightsPage() {
  const articles = await getArticles();
  return (
    <>
      <PageIntro
        eyebrow="Insights"
        title="Insights"
        description="Notes and articles from our software team."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        {articles.length === 0 ? (
          <p className="text-muted-foreground">No articles yet. Check back soon.</p>
        ) : (
          <ul className="space-y-8">
            {articles.map((article) => (
              <li key={article.slug} className="space-y-2">
                <Badge>{article.category}</Badge>
                <h2 className="text-2xl font-semibold tracking-tight">
                  <Link href={`/insights/${article.slug}`} className="hover:underline">
                    {article.title}
                  </Link>
                </h2>
                <p className="text-muted-foreground leading-relaxed">{article.summary}</p>
                <p className="text-muted-foreground text-sm tabular-nums">
                  {article.publishedAt ? <>{formatDateUtc(new Date(article.publishedAt))} · </> : null}
                  {article.readingMinutes} min read
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <CtaBand />
    </>
  );
}
