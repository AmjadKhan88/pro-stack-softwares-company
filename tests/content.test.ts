import { describe, expect, it } from "vitest";
import {
  getCaseStudies,
  getCaseStudyBySlug,
  getServiceBySlug,
  getServices,
} from "@/features/content/repository";

describe("content repository", () => {
  it("has unique slugs", async () => {
    const services = (await getServices()).map((s) => s.slug);
    const studies = (await getCaseStudies()).map((c) => c.slug);
    expect(new Set(services).size).toBe(services.length);
    expect(new Set(studies).size).toBe(studies.length);
  });

  it("links every case study to a service that exists", async () => {
    for (const study of await getCaseStudies()) {
      if (study.serviceSlug) expect(await getServiceBySlug(study.serviceSlug)).not.toBeNull();
    }
  });

  it("never carries outcomes on sample case studies (no fabricated results)", async () => {
    for (const study of await getCaseStudies()) {
      if (study.isDemo) expect(study.outcomes).toEqual([]);
    }
  });

  it("returns null for unknown slugs", async () => {
    expect(await getServiceBySlug("nope")).toBeNull();
    expect(await getCaseStudyBySlug("nope")).toBeNull();
  });
});
