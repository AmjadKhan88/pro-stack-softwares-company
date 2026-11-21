import { Blocks } from "@/components/public-site/blocks";
import { ContentImage } from "@/components/public-site/content-image";
import { Badge } from "@/components/ui/badge";
import type { Article } from "@/features/content/types";
import { formatDateUtc } from "@/lib/format";

export function ArticleBody({ article }: { article: Article }) {
  return (
    <>
      {article.image ? <ContentImage image={article.image} /> : null}
      <header className="space-y-3">
        <Badge>{article.category}</Badge>
        <h1 className="text-4xl font-semibold tracking-tight">{article.title}</h1>
        <p className="text-muted-foreground text-base leading-relaxed">{article.summary}</p>
        <p className="text-muted-foreground text-sm tabular-nums">
          {article.publishedAt ? <>{formatDateUtc(new Date(article.publishedAt))} · </> : null}
          {article.readingMinutes} min read
          {article.author ? <> · {article.author}</> : null}
        </p>
      </header>
      <Blocks blocks={article.blocks} />
    </>
  );
}
