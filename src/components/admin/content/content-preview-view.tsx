import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/public-site/article-body";
import { Blocks } from "@/components/public-site/blocks";
import { CaseStudyBody } from "@/components/public-site/case-study-detail";
import { RichText } from "@/components/public-site/rich-text";
import { ServiceDetailBody } from "@/components/public-site/service-detail";
import { getCaseStudies, getServiceBySlug } from "@/features/content/repository";
import { blockAssetIds } from "@/features/cms/blocks";
import {
  toPublicArticle,
  toPublicCaseStudy,
  toPublicFaq,
  toPublicPage,
  toPublicService,
  type PublishedAsset,
  type PublishedItem,
} from "@/features/cms/mapping";
import { getEntry } from "@/features/cms/service";
import { CONTENT_TYPE_INFO, type ContentType } from "@/features/cms/types";
import { getMediaViewsByIds } from "@/features/media/service";
import { requirePermission } from "@/server/auth/session";

function IncompleteNotice() {
  return (
    <p className="text-muted-foreground text-sm">Add the basics (title and summary) to see a preview.</p>
  );
}

/** Shows the saved DRAFT the way visitors would see it. Staff-only and never public. */
export async function ContentPreviewView({
  type,
  params,
}: {
  type: ContentType;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const info = CONTENT_TYPE_INFO[type];
  await requirePermission("content.edit", `${info.adminPath}/${id}/preview`);
  const entry = await getEntry(id);
  if (!entry || entry.type !== type) notFound();

  // Look up the draft's images so the preview shows them (the public site does the same for what is live).
  const seo = entry.seo as { ogImageAssetId?: unknown } | null;
  const ids = [entry.data.imageAssetId, seo?.ogImageAssetId, ...blockAssetIds(entry.data.blocks)].filter(
    (value): value is string => typeof value === "string",
  );
  const media = await getMediaViewsByIds(ids);
  const assets: Record<string, PublishedAsset> = Object.fromEntries(
    Object.values(media).map((m) => [
      m.id,
      { id: m.id, url: m.url, width: m.width, height: m.height, alt: m.alt },
    ]),
  );
  const item: PublishedItem = { slug: entry.slug, data: entry.data, seo: entry.seo, assets };

  let body: React.ReactNode;
  if (type === "service") {
    const service = toPublicService(item);
    if (!service) body = <IncompleteNotice />;
    else {
      const related = (await getCaseStudies()).filter((c) => c.serviceSlug === service.slug);
      body = (
        <div className="space-y-6">
          <ServiceDetailBody service={service} related={related} />
        </div>
      );
    }
  } else if (type === "case_study") {
    const study = toPublicCaseStudy(item);
    if (!study) body = <IncompleteNotice />;
    else {
      const service = study.serviceSlug ? await getServiceBySlug(study.serviceSlug) : null;
      body = (
        <div className="mx-auto max-w-3xl space-y-8">
          <CaseStudyBody study={study} service={service} />
        </div>
      );
    }
  } else if (type === "article") {
    const article = toPublicArticle(item);
    body = article ? (
      <div className="mx-auto max-w-3xl space-y-8">
        <ArticleBody article={article} />
      </div>
    ) : (
      <IncompleteNotice />
    );
  } else if (type === "page") {
    const page = toPublicPage(item);
    body = page ? (
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
          {page.summary ? (
            <p className="text-muted-foreground text-base leading-relaxed">{page.summary}</p>
          ) : null}
        </header>
        <Blocks blocks={page.blocks} />
      </div>
    ) : (
      <IncompleteNotice />
    );
  } else {
    const faq = toPublicFaq(item);
    body = faq ? (
      <div className="border-border mx-auto max-w-3xl rounded-xl border p-5">
        <p className="font-medium">{faq.question}</p>
        <RichText source={faq.answer} className="text-muted-foreground mt-3" />
      </div>
    ) : (
      <IncompleteNotice />
    );
  }

  return (
    <div className="space-y-6">
      <div
        role="note"
        className="border-border bg-surface-muted flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
      >
        <span className="font-medium">Preview of your saved draft. Visitors can&apos;t see this.</span>
        <Link href={`${info.adminPath}/${entry.id}`} className="text-accent font-medium hover:underline">
          ← Back to editing
        </Link>
      </div>
      {body}
    </div>
  );
}
