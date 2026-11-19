import { readPublished, readRedirectTarget } from "@/features/cms/public-reads";
import { toPublicCaseStudy, toPublicService } from "@/features/cms/mapping";
import { isIndexingAllowed } from "@/lib/seo";
import { caseStudies as demoCaseStudies, faqs, processSteps, services as demoServices } from "./demo-data";
import type { CaseStudy, FaqItem, ProcessStep, Service } from "./types";

// Real content wins as soon as one item is published. Sample content shows only before launch
// (NEXT_PUBLIC_ALLOW_INDEXING is not "true") and only while nothing real is published for that type.

export async function getServices(): Promise<Service[]> {
  const real = (await readPublished("service")).map(toPublicService).filter((s): s is Service => s !== null);
  if (real.length > 0) return real;
  return isIndexingAllowed() ? [] : demoServices;
}
export async function getServiceBySlug(slug: string): Promise<Service | null> {
  return (await getServices()).find((s) => s.slug === slug) ?? null;
}
/** The live address a renamed service now has, if any. */
export async function getServiceRedirect(slug: string): Promise<string | null> {
  return readRedirectTarget("service", slug);
}

export async function getCaseStudies(): Promise<CaseStudy[]> {
  const real = (await readPublished("case_study"))
    .map(toPublicCaseStudy)
    .filter((c): c is CaseStudy => c !== null);
  if (real.length > 0) return real;
  return isIndexingAllowed() ? [] : demoCaseStudies;
}
export async function getCaseStudyBySlug(slug: string): Promise<CaseStudy | null> {
  return (await getCaseStudies()).find((c) => c.slug === slug) ?? null;
}
export async function getCaseStudyRedirect(slug: string): Promise<string | null> {
  return readRedirectTarget("case_study", slug);
}

// Process steps and FAQs become editable in Part 6C.
export async function getProcessSteps(): Promise<ProcessStep[]> {
  return processSteps;
}
export async function getFaqs(): Promise<FaqItem[]> {
  return faqs;
}
