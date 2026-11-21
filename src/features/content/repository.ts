import {
  toPublicArticle,
  toPublicCaseStudy,
  toPublicFaq,
  toPublicPage,
  toPublicService,
} from "@/features/cms/mapping";
import { readPublished, readRedirectMap } from "@/features/cms/public-reads";
import { isIndexingAllowed } from "@/lib/seo";
import {
  caseStudies as demoCaseStudies,
  faqs as demoFaqs,
  processSteps,
  services as demoServices,
} from "./demo-data";
import type { Article, CaseStudy, CmsPage, FaqItem, ProcessStep, Service } from "./types";
import type { ContentType } from "@/features/cms/types";

const present = <T>(value: T | null): value is T => value !== null;

async function redirectTarget(type: ContentType, slug: string): Promise<string | null> {
  const map = await readRedirectMap(type);
  return Object.hasOwn(map, slug) ? map[slug] : null;
}

// Real content wins as soon as one item is published. Sample content shows only before launch
// (NEXT_PUBLIC_ALLOW_INDEXING is not "true") and only while nothing real is published for that type.

export async function getServices(): Promise<Service[]> {
  const real = (await readPublished("service")).map(toPublicService).filter(present);
  if (real.length > 0) return real;
  return isIndexingAllowed() ? [] : demoServices;
}
export async function getServiceBySlug(slug: string): Promise<Service | null> {
  return (await getServices()).find((s) => s.slug === slug) ?? null;
}
export const getServiceRedirect = (slug: string) => redirectTarget("service", slug);

export async function getCaseStudies(): Promise<CaseStudy[]> {
  const real = (await readPublished("case_study")).map(toPublicCaseStudy).filter(present);
  if (real.length > 0) return real;
  return isIndexingAllowed() ? [] : demoCaseStudies;
}
export async function getCaseStudyBySlug(slug: string): Promise<CaseStudy | null> {
  return (await getCaseStudies()).find((c) => c.slug === slug) ?? null;
}
export const getCaseStudyRedirect = (slug: string) => redirectTarget("case_study", slug);

/** Articles have no sample content: there are only real ones. Newest first. */
export async function getArticles(): Promise<Article[]> {
  const articles = (await readPublished("article")).map(toPublicArticle).filter(present);
  return articles.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  return (await getArticles()).find((a) => a.slug === slug) ?? null;
}
export const getArticleRedirect = (slug: string) => redirectTarget("article", slug);

/** Pages made in the admin: privacy, terms, or an edited About / Process. */
export async function getPublishedPages(): Promise<CmsPage[]> {
  return (await readPublished("page")).map(toPublicPage).filter(present);
}
export async function getPage(slug: string): Promise<CmsPage | null> {
  return (await getPublishedPages()).find((p) => p.slug === slug) ?? null;
}
export const getPageRedirect = (slug: string) => redirectTarget("page", slug);

export async function getFaqs(): Promise<FaqItem[]> {
  const real = (await readPublished("faq")).map(toPublicFaq).filter(present);
  if (real.length > 0) return real.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return isIndexingAllowed() ? [] : demoFaqs;
}

// The process steps become editable by publishing a page with the address "process" (Pages in the admin).
export async function getProcessSteps(): Promise<ProcessStep[]> {
  return processSteps;
}
