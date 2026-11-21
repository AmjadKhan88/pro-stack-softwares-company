import { describe, expect, it } from "vitest";
import {
  blockAssetIds,
  blockTexts,
  findPlaceholder,
  parseBlocksJson,
  toEditableBlocks,
  toPublicBlocks,
  validateBlocksForPublish,
} from "@/features/cms/blocks";
import type { Block } from "@/features/cms/block-types";
import { legalDraftPages } from "@/features/cms/legal-templates";
import { toFormValues, toPublicArticle, toPublicFaq, toPublicPage } from "@/features/cms/mapping";
import { isAllowedPageSlug } from "@/features/cms/reserved";
import {
  CONTENT_FORM_FIELDS,
  parseContentForm,
  validateForPublish,
  type RawForm,
} from "@/features/cms/schema";
import type { ArticleData, FaqData, PageData } from "@/features/cms/types";
import { buildSitemapEntries } from "@/features/seo/sitemap-entries";

const ID = "64b7f1c2a3d4e5f60718293a";
const OTHER = "64b7f1c2a3d4e5f607182900";
const assets = {
  [ID]: {
    id: ID,
    url: "https://res.cloudinary.com/c/image/upload/v1/psc/site/a.jpg",
    width: 1600,
    height: 900,
    alt: "A team",
  },
};

const json = (blocks: unknown[]) => JSON.stringify(blocks);

describe("reading the editor's blocks", () => {
  it("accepts every block type and turns the text into real data", () => {
    const result = parseBlocksJson(
      json([
        { type: "richtext", text: "  Hello **world**  " },
        { type: "image", assetId: ID, caption: " A caption " },
        { type: "steps", heading: "How", items: "- Discover | We listen\nBuild\n\nLaunch | We release" },
        { type: "technologies", heading: "", items: "Next.js\n* MongoDB" },
        { type: "cta", heading: "Talk to us", text: "", buttonLabel: "Contact", buttonHref: "/contact" },
      ]),
    );
    expect(result).toEqual({
      ok: true,
      blocks: [
        { type: "richtext", text: "Hello **world**" },
        { type: "image", assetId: ID, caption: "A caption" },
        {
          type: "steps",
          heading: "How",
          items: [
            { title: "Discover", description: "We listen" },
            { title: "Build", description: "" },
            { title: "Launch", description: "We release" },
          ],
        },
        { type: "technologies", items: ["Next.js", "MongoDB"] },
        { type: "cta", heading: "Talk to us", buttonLabel: "Contact", buttonHref: "/contact" },
      ],
    });
  });

  it("treats no content as no blocks", () => {
    expect(parseBlocksJson(undefined)).toEqual({ ok: true, blocks: [] });
    expect(parseBlocksJson("")).toEqual({ ok: true, blocks: [] });
    expect(parseBlocksJson("[]")).toEqual({ ok: true, blocks: [] });
  });

  it("names the block that is wrong", () => {
    const result = parseBlocksJson(
      json([
        { type: "richtext", text: "ok" },
        { type: "image", assetId: "nope", caption: "" },
      ]),
    );
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/^Block 2: /) });
    const steps = parseBlocksJson(json([{ type: "steps", heading: "", items: "| no title" }]));
    expect(steps).toMatchObject({
      ok: false,
      message: "Block 1: Each step needs a title before the | sign.",
    });
  });

  it("rejects unsafe addresses, unknown types, extra fields, and oversized or unreadable input", () => {
    const cta = (buttonHref: string) => ({
      type: "cta",
      heading: "h",
      text: "",
      buttonLabel: "go",
      buttonHref,
    });
    expect(parseBlocksJson(json([cta("javascript:alert(1)")])).ok).toBe(false);
    expect(parseBlocksJson(json([cta("http://example.com")])).ok).toBe(false);
    expect(parseBlocksJson(json([cta("https://example.com")])).ok).toBe(true);
    expect(parseBlocksJson(json([{ type: "html", text: "<b>x</b>" }])).ok).toBe(false);
    expect(parseBlocksJson(json([{ type: "richtext", text: "x", style: "color:red" }])).ok).toBe(false);
    expect(parseBlocksJson(json([{ type: "richtext", text: "x".repeat(20_001) }])).ok).toBe(false);
    expect(
      parseBlocksJson(json(Array.from({ length: 41 }, () => ({ type: "richtext", text: "x" })))).ok,
    ).toBe(false);
    expect(parseBlocksJson("{not json").ok).toBe(false);
    expect(parseBlocksJson('{"type":"richtext"}').ok).toBe(false);
    expect(parseBlocksJson("x".repeat(300_001)).ok).toBe(false);
  });

  it("enforces list limits", () => {
    expect(
      parseBlocksJson(
        json([
          { type: "steps", heading: "", items: Array.from({ length: 13 }, (_, i) => `S${i}`).join("\n") },
        ]),
      ).ok,
    ).toBe(false);
    expect(parseBlocksJson(json([{ type: "technologies", heading: "", items: "x".repeat(41) }])).ok).toBe(
      false,
    );
    expect(parseBlocksJson(json([{ type: "steps", heading: "", items: `${"x".repeat(81)} | d` }])).ok).toBe(
      false,
    );
  });

  it("round-trips: stored blocks show up in the editor and read back the same", () => {
    const first = parseBlocksJson(
      json([
        { type: "richtext", text: "Text" },
        { type: "steps", heading: "How", items: "A | one\nB" },
        { type: "technologies", heading: "", items: "X\nY" },
        { type: "image", assetId: ID, caption: "" },
        { type: "cta", heading: "h", text: "t", buttonLabel: "b", buttonHref: "/x" },
      ]),
    );
    if (!first.ok) throw new Error("setup failed");
    const again = parseBlocksJson(JSON.stringify(toEditableBlocks(first.blocks)));
    expect(again).toEqual(first);
  });

  it("finds the library images a page uses, and ignores anything odd", () => {
    expect(
      blockAssetIds([
        { type: "image", assetId: ID },
        { type: "image", assetId: "nope" },
        { type: "richtext", assetId: OTHER },
      ]),
    ).toEqual([ID]);
    expect(blockAssetIds(null)).toEqual([]);
    expect(blockAssetIds("x")).toEqual([]);
  });
});

describe("what must be complete before publishing blocks", () => {
  it("needs at least one block, and every block filled in", () => {
    expect(validateBlocksForPublish([])).toEqual(["Add at least one block."]);
    const blocks: Block[] = [
      { type: "richtext", text: "" },
      { type: "image", assetId: "" },
      { type: "steps", items: [] },
      { type: "technologies", items: [] },
      { type: "cta", heading: "", buttonLabel: "", buttonHref: "" },
    ];
    const problems = validateBlocksForPublish(blocks);
    expect(problems.length).toBeGreaterThanOrEqual(7);
    expect(problems[0]).toMatch(/^Block 1/);
    expect(validateBlocksForPublish([{ type: "richtext", text: "Hello" }])).toEqual([]);
  });
});

describe("placeholders in template text", () => {
  it("finds [[placeholders]] and ignores ordinary links and brackets", () => {
    expect(findPlaceholder(["fine", "needs [[legal name]] here"])).toBe("[[legal name]]");
    expect(findPlaceholder(["[a link](https://example.com)", "[brackets]", "[[ ]"])).toBeNull();
    expect(findPlaceholder([])).toBeNull();
  });

  it("stops articles, pages and FAQs from being published with one left in", () => {
    const page: PageData = {
      title: "Privacy",
      summary: "",
      blocks: [{ type: "richtext", text: "Contact [[email]]" }],
    };
    expect(validateForPublish("page", page).join(" ")).toMatch(/Replace the placeholder \[\[email\]\]/);
    const article: ArticleData = {
      title: "A post",
      summary: "A summary that is long enough.",
      category: "Eng",
      blocks: [
        { type: "richtext", text: "Fine" },
        { type: "cta", heading: "[[heading]]", buttonLabel: "Go", buttonHref: "/x" },
      ],
    };
    expect(validateForPublish("article", article).join(" ")).toMatch(/placeholder/);
    const faq: FaqData = { title: "How long does it take?", answer: "About [[weeks]] weeks.", position: 0 };
    expect(validateForPublish("faq", faq).join(" ")).toMatch(/placeholder/);
  });

  it("makes the privacy and terms templates safe by design: they read fine but cannot be published as they are", () => {
    const pages = legalDraftPages({ name: "Acme", email: "hi@example.com", location: "Somewhere" });
    expect(pages.map((p) => p.slug)).toEqual(["privacy", "terms"]);
    for (const page of pages) {
      const parsed = parseBlocksJson(JSON.stringify(toEditableBlocks(page.blocks)));
      expect(parsed.ok, page.slug).toBe(true);
      expect(
        validateForPublish("page", { title: page.title, summary: page.summary, blocks: page.blocks }).join(
          " ",
        ),
      ).toMatch(/placeholder/);
      expect(blockTexts(page.blocks).join(" ")).toContain("hi@example.com");
    }
  });
});

describe("page addresses", () => {
  it("never lets a page shadow a built-in route, except the two it may replace", () => {
    for (const reserved of [
      "services",
      "work",
      "faq",
      "contact",
      "insights",
      "login",
      "portal",
      "admin",
      "api",
      "not-found",
    ]) {
      expect(isAllowedPageSlug(reserved), reserved).toBe(false);
    }
    for (const ok of ["about", "process", "privacy", "terms", "careers"])
      expect(isAllowedPageSlug(ok), ok).toBe(true);
  });
});

describe("the editor forms for the new types", () => {
  const ARTICLE: RawForm = {
    slug: "my-first-post",
    title: "My first post",
    summary: "An introduction to how we work.",
    category: "Engineering",
    author: "",
    imageAssetId: "",
    blocks: json([{ type: "richtext", text: "Hello" }]),
    metaTitle: "",
    metaDescription: "",
    noindex: "",
    ogImageAssetId: "",
  };

  it("accepts an article and keeps the blocks with it", () => {
    const result = parseContentForm("article", ARTICLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe("my-first-post");
    expect((result.value.data as ArticleData).blocks).toEqual([{ type: "richtext", text: "Hello" }]);
    expect((result.value.data as ArticleData).author).toBeUndefined();
  });

  it("reports a bad block against the blocks field, and other mistakes at the same time", () => {
    const result = parseContentForm("article", {
      ...ARTICLE,
      slug: "Bad Slug",
      blocks: json([{ type: "image", assetId: "nope", caption: "" }]),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.slug).toBeDefined();
    expect(result.fieldErrors.blocks).toMatch(/^Block 1/);
  });

  it("accepts a page, refuses a built-in address, allows about and process", () => {
    const page: RawForm = {
      slug: "privacy",
      title: "Privacy",
      summary: "",
      blocks: json([{ type: "richtext", text: "x" }]),
      metaTitle: "",
      metaDescription: "",
      noindex: "",
      ogImageAssetId: "",
    };
    expect(parseContentForm("page", page).ok).toBe(true);
    const clash = parseContentForm("page", { ...page, slug: "services" });
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.fieldErrors.slug).toMatch(/already uses/);
    expect(parseContentForm("page", { ...page, slug: "about" }).ok).toBe(true);
    expect(parseContentForm("page", { ...page, slug: "process" }).ok).toBe(true);
    expect(parseContentForm("page", { ...page, slug: "not-found" }).ok).toBe(false);
  });

  it("accepts an FAQ, which has no address of its own", () => {
    const result = parseContentForm("faq", {
      title: "How long does a project take?",
      answer: "It depends on scope.",
      position: "3",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe("");
    expect(result.value.data).toEqual({
      title: "How long does a project take?",
      answer: "It depends on scope.",
      position: 3,
    });
    expect(parseContentForm("faq", { title: "Q?", answer: "", position: "" }).ok).toBe(false);
    expect(parseContentForm("faq", { title: "A fine question?", answer: "", position: "1000" }).ok).toBe(
      false,
    );
    expect(parseContentForm("faq", { title: "A fine question?", answer: "", position: "abc" }).ok).toBe(
      false,
    );
    const defaulted = parseContentForm("faq", { title: "A fine question?", answer: "Yes." });
    if (defaulted.ok) expect((defaulted.value.data as FaqData).position).toBe(0);
  });

  it("round-trips article, page and FAQ through the edit form", () => {
    for (const type of ["article", "page"] as const) {
      const form =
        type === "article"
          ? ARTICLE
          : {
              slug: "terms",
              title: "Terms",
              summary: "",
              blocks: ARTICLE.blocks,
              metaTitle: "",
              metaDescription: "",
              noindex: "",
              ogImageAssetId: "",
            };
      const first = parseContentForm(type, form);
      if (!first.ok) throw new Error("setup failed");
      expect(
        parseContentForm(type, toFormValues(type, first.value.slug, first.value.data, first.value.seo)),
      ).toEqual(first);
    }
    const faq = parseContentForm("faq", { title: "A fine question?", answer: "Yes.", position: "2" });
    if (!faq.ok) throw new Error("setup failed");
    expect(parseContentForm("faq", toFormValues("faq", "", faq.value.data, faq.value.seo))).toEqual(faq);
  });

  it("knows the form fields of every type", () => {
    expect(CONTENT_FORM_FIELDS.faq).toEqual(["title", "answer", "position"]);
    expect(CONTENT_FORM_FIELDS.article).toContain("blocks");
    expect(CONTENT_FORM_FIELDS.page).toContain("blocks");
  });
});

describe("what the public site shows", () => {
  const item = (data: object, extra: object = {}) => ({
    slug: "a-post",
    data,
    seo: {},
    assets,
    publishedAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-02-03T00:00:00.000Z",
    ...extra,
  });

  it("builds an article with dates, reading time and resolved images", () => {
    const article = toPublicArticle(
      item({
        title: "A post",
        summary: "About things.",
        category: "Eng",
        author: " Sam ",
        imageAssetId: ID,
        blocks: [
          { type: "richtext", text: "word ".repeat(450) },
          { type: "image", assetId: ID, caption: "Cap" },
        ],
      }),
    );
    expect(article).toMatchObject({
      title: "A post",
      author: "Sam",
      publishedAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-02-03T00:00:00.000Z",
      readingMinutes: 3,
    });
    expect(article?.image?.alt).toBe("A team");
    expect(article?.blocks).toHaveLength(2);
  });

  it("skips damaged blocks instead of failing, and never lets an unsafe address through", () => {
    const blocks = toPublicBlocks(
      [
        { type: "richtext", text: "   " },
        { type: "richtext", text: "Fine" },
        { type: "image", assetId: "64b7f1c2a3d4e5f607182999", caption: "" },
        {
          type: "steps",
          items: [
            { title: "", description: "x" },
            { title: "Real", description: "" },
          ],
        },
        { type: "technologies", items: [1, "", "Next.js"] },
        { type: "cta", heading: "Go", buttonLabel: "Now", buttonHref: "javascript:alert(1)" },
        { type: "cta", heading: "Go", buttonLabel: "Now", buttonHref: "/contact" },
        { type: "video", url: "https://youtube.com/x" },
        null,
        "string",
        5,
      ],
      assets,
    );
    expect(blocks).toEqual([
      { type: "richtext", text: "Fine" },
      { type: "steps", items: [{ title: "Real", description: "" }] },
      { type: "technologies", items: ["Next.js"] },
      { type: "cta", heading: "Go", buttonLabel: "Now", buttonHref: "/contact" },
    ]);
  });

  it("never throws on malformed stored data", () => {
    for (const data of [
      null,
      undefined,
      5,
      "text",
      [],
      { title: 5 },
      { title: "T", summary: "S", blocks: "no" },
      { title: "T", summary: "S", blocks: [null, 7, {}] },
    ]) {
      expect(() => toPublicArticle(item(data as object))).not.toThrow();
      expect(() => toPublicPage(item(data as object))).not.toThrow();
      expect(() => toPublicFaq(item(data as object))).not.toThrow();
    }
    expect(toPublicArticle(item({ title: "T" }))).toBeNull();
    expect(toPublicPage(item({}))).toBeNull();
    expect(toPublicFaq(item({ title: "Q" }))).toBeNull();
  });

  it("orders FAQs by their number", () => {
    expect(toPublicFaq(item({ title: "Q?", answer: "A.", position: 4 }))?.position).toBe(4);
    expect(toPublicFaq(item({ title: "Q?", answer: "A.", position: "x" }))?.position).toBe(0);
  });
});

describe("the sitemap with articles and pages", () => {
  it("lists live articles and pages, skips those hidden from search, and never repeats an address", () => {
    const urls = buildSitemapEntries({
      siteUrl: "https://example.com",
      services: [],
      caseStudies: [],
      articles: [{ slug: "post" }, { slug: "secret", seo: { noindex: true } }],
      pages: [{ slug: "privacy" }, { slug: "about" }, { slug: "hidden", seo: { noindex: true } }],
    }).map((entry) => entry.url);
    expect(urls).toContain("https://example.com/insights");
    expect(urls).toContain("https://example.com/insights/post");
    expect(urls).toContain("https://example.com/privacy");
    expect(urls).not.toContain("https://example.com/insights/secret");
    expect(urls).not.toContain("https://example.com/hidden");
    expect(urls.filter((url) => url === "https://example.com/about")).toHaveLength(1);
  });

  it("leaves out the Insights index until there is an article", () => {
    const urls = buildSitemapEntries({ siteUrl: "https://example.com", services: [], caseStudies: [] }).map(
      (e) => e.url,
    );
    expect(urls).not.toContain("https://example.com/insights");
  });
});
