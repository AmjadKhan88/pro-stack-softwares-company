import type { CaseStudy, PublicSeo, Service } from "@/features/content/types";
import type { RawForm } from "./schema";
import type { ContentType } from "./types";

/** What the public site reads: the published snapshot only. */
export interface PublishedItem {
  slug: string;
  data: unknown;
  seo: unknown;
}

// Stored content is read defensively: malformed data can't crash a public page.
export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const str = (value: unknown, max = 10_000): string =>
  typeof value === "string" ? value.slice(0, max) : "";

export const list = (value: unknown, max = 50): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim() !== "")
        .map((item) => item.slice(0, 500))
        .slice(0, max)
    : [];

export function readSeo(value: unknown): PublicSeo {
  const seo = asRecord(value);
  const title = str(seo.metaTitle, 70).trim();
  const description = str(seo.metaDescription, 170).trim();
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    noindex: seo.noindex === true,
  };
}

/** Returns null for an item with no usable title and summary, so it is skipped rather than shown broken. */
export function toPublicService(item: PublishedItem): Service | null {
  const d = asRecord(item.data);
  const title = str(d.title).trim();
  const summary = str(d.summary).trim();
  if (!title || !summary) return null;
  return {
    slug: item.slug,
    title,
    summary,
    description: str(d.description),
    deliverables: list(d.deliverables, 20),
    isDemo: false,
    seo: readSeo(item.seo),
  };
}

export function toPublicCaseStudy(item: PublishedItem): CaseStudy | null {
  const d = asRecord(item.data);
  const title = str(d.title).trim();
  const summary = str(d.summary).trim();
  if (!title || !summary) return null;
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
    seo: readSeo(item.seo),
  };
}

/** Turns stored data back into form values, so the edit form shows what was saved. */
export function toFormValues(type: ContentType, slug: string, data: unknown, seo: unknown): RawForm {
  const d = asRecord(data);
  const s = asRecord(seo);
  const base: RawForm = {
    slug,
    title: str(d.title),
    summary: str(d.summary),
    metaTitle: str(s.metaTitle),
    metaDescription: str(s.metaDescription),
    noindex: s.noindex === true ? "on" : "",
  };
  if (type === "service") {
    return { ...base, description: str(d.description), deliverables: list(d.deliverables).join("\n") };
  }
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
}
