import { describe, expect, it } from "vitest";
import { AUDIT_LABELS } from "@/features/audit/labels";
import { AUDIT_ACTIONS } from "@/features/audit/types";
import { parseContentFilters } from "@/features/cms/list-params";
import { toFormValues, toPublicCaseStudy, toPublicService } from "@/features/cms/mapping";
import {
  CONTENT_FORM_FIELDS,
  entryIdSchema,
  entryVersionSchema,
  parseContentForm,
  pickFields,
  restoreSchema,
  validateForPublish,
  type RawForm,
} from "@/features/cms/schema";
import { isValidSlug, slugify } from "@/features/cms/slug";
import {
  CONTENT_STATUSES,
  canMoveContent,
  isEditable,
  type CaseStudyData,
  type ServiceData,
} from "@/features/cms/types";
import { buildSitemapEntries } from "@/features/seo/sitemap-entries";

const ID = "64b7f1c2a3d4e5f60718293a";

const SERVICE_FORM: RawForm = {
  slug: "  Web-Applications ",
  title: "Web applications",
  summary: "Custom web applications for your business.",
  description: "We design, build and run web applications that solve a clear business problem for your team.",
  deliverables: "- Design\n* Working application\n\nDeployment",
  metaTitle: "",
  metaDescription: "Custom web apps.",
  noindex: "",
};

const CASE_FORM: RawForm = {
  slug: "booking-platform",
  title: "Booking platform",
  category: "Web application",
  summary: "An online booking platform for a group of clinics.",
  challenge:
    "Paper diaries and phone calls led to double bookings and long waits for patients at every clinic.",
  approach:
    "We started with the booking flow, tested it with front-desk staff, then built the staff dashboard.",
  features: "Online booking\nStaff dashboard",
  stack: "Next.js\nMongoDB",
  outcomes: "",
  outcomesVerified: "",
  serviceSlug: "",
  metaTitle: "",
  metaDescription: "",
  noindex: "on",
};

describe("slugs", () => {
  it("accepts well-formed slugs and rejects everything else", () => {
    for (const ok of ["abc", "web-applications", "a1-b2-c3", "x".repeat(80)])
      expect(isValidSlug(ok), ok).toBe(true);
    for (const bad of [
      "ab",
      "x".repeat(81),
      "Web",
      "web_apps",
      "web--apps",
      "-web",
      "web-",
      "web apps",
      "../etc",
      "web/apps",
      "",
    ]) {
      expect(isValidSlug(bad), bad).toBe(false);
    }
  });

  it("builds a slug from a title", () => {
    expect(slugify("Web Apps & Portals!")).toBe("web-apps-portals");
    expect(slugify("  Café Résumé  ")).toBe("cafe-resume");
    expect(slugify("اردو عنوان")).toBe("");
    expect(slugify("x".repeat(200))).toHaveLength(80);
    expect(isValidSlug(slugify("A title, with: punctuation"))).toBe(true);
  });
});

describe("content lifecycle", () => {
  it("allows publish, republish and unpublish, archive only from draft, and restore only from archive", () => {
    expect(canMoveContent("draft", "published")).toBe(true);
    expect(canMoveContent("published", "published")).toBe(true);
    expect(canMoveContent("published", "draft")).toBe(true);
    expect(canMoveContent("draft", "archived")).toBe(true);
    expect(canMoveContent("archived", "draft")).toBe(true);
    expect(canMoveContent("published", "archived")).toBe(false);
    expect(canMoveContent("archived", "published")).toBe(false);
  });

  it("makes archived items read-only", () => {
    for (const status of CONTENT_STATUSES) expect(isEditable(status)).toBe(status !== "archived");
  });
});

describe("parsing the editor form", () => {
  it("accepts a service and normalises the text", () => {
    const result = parseContentForm("service", SERVICE_FORM);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe("web-applications");
    expect((result.value.data as ServiceData).deliverables).toEqual([
      "Design",
      "Working application",
      "Deployment",
    ]);
    expect(result.value.seo).toEqual({
      metaTitle: undefined,
      metaDescription: "Custom web apps.",
      noindex: false,
    });
  });

  it("accepts a case study, with the checkbox and an empty related service", () => {
    const result = parseContentForm("case_study", CASE_FORM);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.value.data as CaseStudyData;
    expect(data.features).toEqual(["Online booking", "Staff dashboard"]);
    expect(data.serviceSlug).toBeUndefined();
    expect(data.outcomesVerified).toBe(false);
    expect(result.value.seo.noindex).toBe(true);
  });

  it("allows an incomplete draft but needs a title and a valid slug", () => {
    expect(parseContentForm("service", { slug: "draft-one", title: "Draft one" }).ok).toBe(false); // missing text fields
    const sparse = { ...SERVICE_FORM, summary: "", description: "", deliverables: "" };
    expect(parseContentForm("service", sparse).ok).toBe(true);
    const noTitle = parseContentForm("service", { ...SERVICE_FORM, title: " " });
    expect(noTitle.ok).toBe(false);
    if (!noTitle.ok) expect(noTitle.fieldErrors.title).toBeDefined();
    const badSlug = parseContentForm("service", { ...SERVICE_FORM, slug: "Not A Slug!" });
    expect(badSlug.ok).toBe(false);
    if (!badSlug.ok) expect(badSlug.fieldErrors.slug).toMatch(/lowercase/);
  });

  it("enforces size limits", () => {
    expect(parseContentForm("service", { ...SERVICE_FORM, title: "x".repeat(121) }).ok).toBe(false);
    expect(parseContentForm("service", { ...SERVICE_FORM, description: "x".repeat(4001) }).ok).toBe(false);
    expect(parseContentForm("service", { ...SERVICE_FORM, deliverables: "x\n".repeat(21) }).ok).toBe(false);
    expect(parseContentForm("service", { ...SERVICE_FORM, metaTitle: "x".repeat(71) }).ok).toBe(false);
    expect(parseContentForm("case_study", { ...CASE_FORM, serviceSlug: "Bad Slug" }).ok).toBe(false);
    expect(parseContentForm("case_study", { ...CASE_FORM, outcomes: "x\n".repeat(11) }).ok).toBe(false);
  });

  it("keeps HTML as plain text and never as markup (it is only ever rendered as text)", () => {
    const result = parseContentForm("service", { ...SERVICE_FORM, title: "<script>alert(1)</script>" });
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.value.data as ServiceData).title).toBe("<script>alert(1)</script>");
  });

  it("ignores framework and forged form entries", () => {
    const fd = new FormData();
    for (const [key, value] of Object.entries(SERVICE_FORM)) fd.set(key, value ?? "");
    fd.set("status", "published");
    fd.set("publishedSlug", "hijack");
    fd.set("$ACTION_ID_x", "1");
    fd.set("imageAssetId", "");
    fd.set("ogImageAssetId", "");
    const picked = pickFields(fd, CONTENT_FORM_FIELDS.service);
    expect(Object.keys(picked).sort()).toEqual([...CONTENT_FORM_FIELDS.service].sort());
    expect(parseContentForm("service", picked).ok).toBe(true);
  });

  it("round-trips: what is stored shows up in the edit form unchanged", () => {
    for (const [type, form] of [
      ["service", SERVICE_FORM],
      ["case_study", CASE_FORM],
    ] as const) {
      const first = parseContentForm(type, form);
      if (!first.ok) throw new Error("setup failed");
      const again = parseContentForm(
        type,
        toFormValues(type, first.value.slug, first.value.data, first.value.seo),
      );
      expect(again).toEqual(first);
    }
  });

  it("validates the ids used by lifecycle actions", () => {
    expect(entryIdSchema.safeParse({ entryId: ID }).success).toBe(true);
    expect(entryIdSchema.safeParse({ entryId: "x" }).success).toBe(false);
    expect(entryVersionSchema.safeParse({ entryId: ID, expectedVersion: "3" }).success).toBe(true);
    expect(entryVersionSchema.safeParse({ entryId: ID, expectedVersion: "0" }).success).toBe(false);
    expect(entryVersionSchema.safeParse({ entryId: ID, expectedVersion: "abc" }).success).toBe(false);
    expect(
      entryVersionSchema.safeParse({ entryId: ID, expectedVersion: "1", status: "published" }).success,
    ).toBe(false);
    expect(restoreSchema.safeParse({ entryId: ID, revisionId: ID, expectedVersion: "2" }).success).toBe(true);
    expect(restoreSchema.safeParse({ entryId: ID, revisionId: "nope", expectedVersion: "2" }).success).toBe(
      false,
    );
  });
});

describe("what must be complete before publishing", () => {
  const service = (parseContentForm("service", SERVICE_FORM) as { ok: true; value: { data: ServiceData } })
    .value.data;
  const study = (parseContentForm("case_study", CASE_FORM) as { ok: true; value: { data: CaseStudyData } })
    .value.data;

  it("accepts complete content", () => {
    expect(validateForPublish("service", service)).toEqual([]);
    expect(validateForPublish("case_study", study)).toEqual([]);
  });

  it("lists every missing piece in plain language", () => {
    const problems = validateForPublish("service", {
      title: "ab",
      summary: "",
      description: "short",
      deliverables: [],
    });
    expect(problems).toHaveLength(4);
    const caseProblems = validateForPublish("case_study", {
      title: "Booking",
      category: "",
      summary: "short",
      challenge: "",
      approach: "",
      features: [],
      stack: [],
      outcomes: [],
      outcomesVerified: false,
    });
    expect(caseProblems.length).toBeGreaterThanOrEqual(6);
  });

  it("refuses to publish results nobody confirmed are real", () => {
    expect(
      validateForPublish("case_study", { ...study, outcomes: ["Bookings up 40%"], outcomesVerified: false }),
    ).toEqual(["Tick the box confirming the outcomes are real and verifiable, or remove them."]);
    expect(
      validateForPublish("case_study", { ...study, outcomes: ["Bookings up 40%"], outcomesVerified: true }),
    ).toEqual([]);
    expect(validateForPublish("case_study", { ...study, outcomes: [], outcomesVerified: false })).toEqual([]);
  });
});

describe("what the public site shows", () => {
  const ok = {
    slug: "web-applications",
    data: { title: "Web apps", summary: "Custom apps.", description: "Long text", deliverables: ["A", "B"] },
    seo: { metaTitle: "Web apps | Pro Stack", noindex: true },
  };

  it("maps a service and its search settings", () => {
    const service = toPublicService(ok);
    expect(service).toMatchObject({
      slug: "web-applications",
      title: "Web apps",
      isDemo: false,
      deliverables: ["A", "B"],
    });
    expect(service?.seo).toEqual({ title: "Web apps | Pro Stack", noindex: true });
  });

  it("skips content with no usable title or summary instead of showing it broken", () => {
    expect(toPublicService({ slug: "x", data: {}, seo: {} })).toBeNull();
    expect(toPublicService({ slug: "x", data: { title: "T" }, seo: {} })).toBeNull();
    expect(toPublicCaseStudy({ slug: "x", data: { summary: "S" }, seo: {} })).toBeNull();
  });

  it("never throws on malformed stored data", () => {
    for (const data of [
      null,
      undefined,
      5,
      "text",
      [],
      { title: 5, summary: {}, deliverables: "no" },
      { title: "T", summary: "S", deliverables: [1, null, "ok", ""] },
    ]) {
      expect(() => toPublicService({ slug: "x", data, seo: null })).not.toThrow();
      expect(() => toPublicCaseStudy({ slug: "x", data, seo: 7 })).not.toThrow();
    }
    expect(
      toPublicService({
        slug: "x",
        data: { title: "T", summary: "S", deliverables: [1, null, "ok", ""] },
        seo: null,
      })?.deliverables,
    ).toEqual(["ok"]);
  });

  it("shows outcomes only when an editor confirmed them", () => {
    const base = { title: "T", summary: "S", outcomes: ["Result"] };
    expect(
      toPublicCaseStudy({ slug: "x", data: { ...base, outcomesVerified: false }, seo: {} })?.outcomes,
    ).toEqual([]);
    expect(toPublicCaseStudy({ slug: "x", data: { ...base }, seo: {} })?.outcomes).toEqual([]);
    expect(
      toPublicCaseStudy({ slug: "x", data: { ...base, outcomesVerified: "true" }, seo: {} })?.outcomes,
    ).toEqual([]);
    expect(
      toPublicCaseStudy({ slug: "x", data: { ...base, outcomesVerified: true }, seo: {} })?.outcomes,
    ).toEqual(["Result"]);
  });
});

describe("the sitemap", () => {
  it("lists live items, but not samples or pages hidden from search engines", () => {
    const entries = buildSitemapEntries({
      siteUrl: "https://example.com",
      services: [
        { slug: "live", isDemo: false },
        { slug: "hidden", isDemo: false, seo: { noindex: true } },
        { slug: "sample", isDemo: true },
      ],
      caseStudies: [{ slug: "case", isDemo: false, seo: { noindex: false } }],
    }).map((entry) => entry.url);
    expect(entries).toContain("https://example.com/services/live");
    expect(entries).toContain("https://example.com/work/case");
    expect(entries).not.toContain("https://example.com/services/hidden");
    expect(entries).not.toContain("https://example.com/services/sample");
  });
});

describe("list filters", () => {
  it("keeps valid values and ignores everything else", () => {
    expect(parseContentFilters({ q: "  web ", status: "published", page: "2" })).toEqual({
      q: "web",
      status: "published",
      page: 2,
    });
    expect(parseContentFilters({ status: "deleted", page: "-3", q: "  " })).toEqual({
      q: undefined,
      status: undefined,
      page: 1,
    });
    expect(parseContentFilters({ status: ["$ne", "draft"] }).status).toBeUndefined();
    expect(parseContentFilters({ q: "x".repeat(300) }).q).toHaveLength(100);
  });
});

describe("audit labels", () => {
  it("still cover every audit action", () => {
    expect(Object.keys(AUDIT_LABELS).sort()).toEqual([...AUDIT_ACTIONS].sort());
  });
});
