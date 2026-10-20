import { caseStudies, faqs, processSteps, services } from "./demo-data";
import type { CaseStudy, FaqItem, ProcessStep, Service } from "./types";

// Async on purpose: Phase 6 swaps this file's internals to MongoDB without touching any page.

export async function getServices(): Promise<Service[]> {
  return services;
}
export async function getServiceBySlug(slug: string): Promise<Service | null> {
  return services.find((s) => s.slug === slug) ?? null;
}
export async function getCaseStudies(): Promise<CaseStudy[]> {
  return caseStudies;
}
export async function getCaseStudyBySlug(slug: string): Promise<CaseStudy | null> {
  return caseStudies.find((c) => c.slug === slug) ?? null;
}
export async function getProcessSteps(): Promise<ProcessStep[]> {
  return processSteps;
}
export async function getFaqs(): Promise<FaqItem[]> {
  return faqs;
}
