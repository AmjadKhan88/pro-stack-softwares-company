import type { Article, CaseStudy, CmsPage, FaqItem, PublicSeo, Service } from "@/features/content/types";
import { editableBlocksJson, toPublicBlocks } from "./blocks";
import { asRecord, list, resolveImage, str, type PublishedAsset } from "./read-helpers";
import { plainText, wordCount } from "./richtext";
import type { RawForm } from "./schema";
import type { ContentType } from "./types";

export { asRecord, list, str };
export type { PublishedAsset };

/** What the public site reads: the published snapshot only. */
export interface PublishedItem {
  slug: string;
  data: unknown;
  seo: unknown;
  assets?: Record<string, PublishedAsset>;
  /** ISO dates: when it first went live, and when it was last published. */
  publishedAt?: string;
  updatedAt?: string;
}

export function readSeo(value: unknown, assets?: Record<string, PublishedAsset>): PublicSeo {
  const seo = asRecord(value);
  const title = str(seo.metaTitle, 70).trim();
  const description = str(seo.metaDescription, 170).trim();
  const ogImage = resolveImage(seo.ogImageAssetId, assets);
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(ogImage ? { ogImage } : {}),
    noindex: seo.noindex === true,
  };
}

/** Returns null for an item with no usable title and summary, so it is skipped rather than shown broken. */
export function toPublicService(item: PublishedItem): Service | null {
  const d = asRecord(item.data);
  const title = str(d.title).trim();
  const summary = str(d.summary).trim();
  if (!title || !summary) return null;
  const image = resolveImage(d.imageAssetId, item.assets);
  return {
    slug: item.slug,
    title,
    summary,
    description: str(d.description),
    deliverables: list(d.deliverables, 20),
    isDemo: false,
    seo: readSeo(item.seo, item.assets),
    ...(image ? { image } : {}),
  };
}

export function toPublicCaseStudy(item: PublishedItem): CaseStudy | null {
  const d = asRecord(item.data);
  const title = str(d.title).trim();
  const summary = str(d.summary).trim();
  if (!title || !summary) return null;
  const image = resolveImage(d.imageAssetId, item.assets);
  return {
    slug: item.slug,
    title,
    category: str(d.category).trim() || "Project",
    summary,
    challenge: str(d.challenge),
    approach: str(d.approach),
    features: list(d.features, 20),
    stack: list(d.stack, 20),
    // Results are shown only when an editor confirmed they are real. This is checked again at render time.
    outcomes: d.outcomesVerified === true ? list(d.outcomes, 10) : [],
    serviceSlug: str(d.serviceSlug).trim() || undefined,
    isDemo: false,
    seo: readSeo(item.seo, item.assets),
    ...(image ? { image } : {}),
  };
}

export function toPublicArticle(item: PublishedItem): Article | null {
  const d = asRecord(item.data);
  const title = str(d.title).trim();
  const summary = str(d.summary).trim();
  if (!title || !summary) return null;
  const blocks = toPublicBlocks(d.blocks, item.assets);
  const image = resolveImage(d.imageAssetId, item.assets);
  const words = blocks.reduce(
    (sum, block) => sum + (block.type === "richtext" ? wordCount(block.text) : 0),
    0,
  );
  const author = str(d.author, 80).trim();
  return {
    slug: item.slug,
    title,
    summary,
    category: str(d.category).trim() || "Article",
    ...(author ? { author } : {}),
    ...(image ? { image } : {}),
    blocks,
    publishedAt: item.publishedAt ?? null,
    updatedAt: item.updatedAt ?? item.publishedAt ?? null,
    readingMinutes: Math.max(1, Math.ceil(words / 200)),
    seo: readSeo(item.seo, item.assets),
  };
}

export function toPublicPage(item: PublishedItem): CmsPage | null {
  const d = asRecord(item.data);
  const title = str(d.title).trim();
  if (!title) return null;
  return {
    slug: item.slug,
    title,
    summary: str(d.summary).trim(),
    blocks: toPublicBlocks(d.blocks, item.assets),
    updatedAt: item.updatedAt ?? item.publishedAt ?? null,
    seo: readSeo(item.seo, item.assets),
  };
}

export function toPublicFaq(item: PublishedItem): FaqItem | null {
  const d = asRecord(item.data);
  const question = str(d.title).trim();
  const answer = str(d.answer, 4000).trim();
  if (!question || !answer) return null;
  const position = typeof d.position === "number" && Number.isFinite(d.position) ? d.position : 0;
  return { question, answer, isDemo: false, position };
}

/** An FAQ answer as plain words (for search-engine data), with the formatting removed. */
export const faqAnswerText = (answer: string): string => plainText(answer);

/** Turns stored data back into form values, so the edit form shows what was saved. */
export function toFormValues(type: ContentType, slug: string, data: unknown, seo: unknown): RawForm {
  const d = asRecord(data);
  const s = asRecord(seo);

  if (type === "faq") {
    return {
      title: str(d.title),
      answer: str(d.answer, 4000),
      position: String(typeof d.position === "number" ? d.position : 0),
    };
  }

  const base: RawForm = {
    slug,
    title: str(d.title),
    summary: str(d.summary),
    imageAssetId: str(d.imageAssetId),
    metaTitle: str(s.metaTitle),
    metaDescription: str(s.metaDescription),
    noindex: s.noindex === true ? "on" : "",
    ogImageAssetId: str(s.ogImageAssetId),
  };
  switch (type) {
    case "service":
      return { ...base, description: str(d.description), deliverables: list(d.deliverables).join("\n") };
    case "case_study":
      return {
        ...base,
        category: str(d.category),
        challenge: str(d.challenge),
        approach: str(d.approach),
        features: list(d.features).join("\n"),
        stack: list(d.stack).join("\n"),
        outcomes: list(d.outcomes).join("\n"),
        outcomesVerified: d.outcomesVerified === true ? "on" : "",
        serviceSlug: str(d.serviceSlug),
      };
    case "article":
      return {
        ...base,
        category: str(d.category),
        author: str(d.author),
        blocks: editableBlocksJson(d.blocks),
      };
    case "page":
      return { ...base, blocks: editableBlocksJson(d.blocks) };
  }
}
