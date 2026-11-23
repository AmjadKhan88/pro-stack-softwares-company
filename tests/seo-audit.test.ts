import { describe, expect, it } from "vitest";
import {
  SEO_MESSAGES,
  auditItem,
  markDuplicates,
  sortRows,
  summarize,
  type SeoItemInput,
} from "@/features/seo/audit";

const IMG = "64b7f1c2a3d4e5f60718293a";
const OTHER = "64b7f1c2a3d4e5f607182900";

function item(data: object, seo: object = {}, overrides: Partial<SeoItemInput> = {}): SeoItemInput {
  return {
    type: "service",
    id: "e1",
    slug: "web-apps",
    data: { title: "Web applications", summary: "x".repeat(80), ...data },
    seo,
    availableAssetIds: new Set<string>([IMG]),
    ...overrides,
  };
}
const messages = (row: ReturnType<typeof auditItem>) => row.issues.map((i) => i.message);

describe("checking one page", () => {
  it("is clean when everything is set properly", () => {
    const row = auditItem(item({ imageAssetId: IMG }, { metaDescription: "x".repeat(100) }));
    expect(row.issues).toEqual([]);
    expect(row).toMatchObject({
      url: "/services/web-apps",
      descriptionSource: "custom",
      shareImage: "main",
      indexed: true,
    });
  });

  it("notes when the summary stands in for a description, and flags no description at all", () => {
    expect(messages(auditItem(item({ imageAssetId: IMG })))).toContain(SEO_MESSAGES.summaryUsed);
    const none = auditItem(item({ summary: "", imageAssetId: IMG }));
    expect(none.descriptionSource).toBe("none");
    expect(none.issues.find((i) => i.message === SEO_MESSAGES.noDescription)?.severity).toBe("problem");
  });

  it("warns about descriptions and titles that are too long or too short", () => {
    expect(messages(auditItem(item({ imageAssetId: IMG }, { metaDescription: "x".repeat(165) })))).toContain(
      SEO_MESSAGES.descriptionLong,
    );
    expect(messages(auditItem(item({ imageAssetId: IMG }, { metaDescription: "too short" })))).toContain(
      SEO_MESSAGES.descriptionShort,
    );
    expect(
      messages(
        auditItem(item({ title: "T".repeat(61), imageAssetId: IMG }, { metaDescription: "x".repeat(100) })),
      ),
    ).toContain(SEO_MESSAGES.titleLong);
    expect(
      messages(
        auditItem(
          item(
            { title: "T".repeat(61), imageAssetId: IMG },
            { metaTitle: "Short title", metaDescription: "x".repeat(100) },
          ),
        ),
      ),
    ).not.toContain(SEO_MESSAGES.titleLong);
  });

  it("works out which sharing image will be used", () => {
    expect(auditItem(item({ imageAssetId: IMG })).shareImage).toBe("main");
    expect(auditItem(item({}, { ogImageAssetId: IMG })).shareImage).toBe("own");
    const none = auditItem(item({}));
    expect(none.shareImage).toBe("none");
    expect(messages(none)).toContain(SEO_MESSAGES.noShareImage);
  });

  it("flags images that were archived or removed", () => {
    const gone = auditItem(
      item({ imageAssetId: OTHER }, { ogImageAssetId: OTHER, metaDescription: "x".repeat(100) }),
    );
    expect(gone.issues.filter((i) => i.severity === "problem").map((i) => i.message)).toEqual(
      expect.arrayContaining([SEO_MESSAGES.shareImageGone, SEO_MESSAGES.mainImageGone]),
    );
    expect(gone.shareImage).toBe("none");
    expect(messages(gone)).not.toContain(SEO_MESSAGES.noShareImage);
  });

  it("reports pages hidden from search engines, without nagging about search wording", () => {
    const row = auditItem(item({ summary: "", imageAssetId: IMG }, { noindex: true }));
    expect(row.indexed).toBe(false);
    expect(messages(row)).toEqual([SEO_MESSAGES.hidden]);
  });

  it("never throws on damaged data", () => {
    for (const data of [null, undefined, 5, "text", [], { title: 5 }]) {
      expect(() => auditItem({ ...item({}), data, seo: data })).not.toThrow();
    }
  });
});

describe("the whole site", () => {
  const rows = () => [
    auditItem(
      item(
        { title: "Same title", imageAssetId: IMG },
        { metaDescription: "x".repeat(100) },
        { id: "a", slug: "a" },
      ),
    ),
    auditItem(
      item(
        { title: "Same title", imageAssetId: IMG },
        { metaDescription: "y".repeat(100) },
        { id: "b", slug: "b" },
      ),
    ),
    auditItem(
      item(
        { title: "Different", imageAssetId: IMG },
        { metaDescription: "z".repeat(100) },
        { id: "c", slug: "c" },
      ),
    ),
    auditItem(item({ title: "Same title", imageAssetId: IMG }, { noindex: true }, { id: "d", slug: "d" })),
  ];

  it("warns when two live pages share a title, but ignores hidden pages", () => {
    const marked = markDuplicates(rows());
    expect(marked[0].issues.some((i) => /Same page title as "Same title"/.test(i.message))).toBe(true);
    expect(marked[1].issues.some((i) => /Same page title/.test(i.message))).toBe(true);
    expect(marked[2].issues.some((i) => /Same page title/.test(i.message))).toBe(false);
    expect(marked[3].issues.some((i) => /Same page title/.test(i.message))).toBe(false);
  });

  it("lists problems first, then tips, then clean pages", () => {
    const broken = auditItem(item({ summary: "", imageAssetId: IMG }, {}, { id: "p", slug: "p" }));
    const tip = auditItem(item({ imageAssetId: IMG }, { metaDescription: "short" }, { id: "t", slug: "t" }));
    const clean = auditItem(
      item({ imageAssetId: IMG }, { metaDescription: "x".repeat(100) }, { id: "c", slug: "c" }),
    );
    expect(sortRows([clean, tip, broken]).map((r) => r.id)).toEqual(["p", "t", "c"]);
  });

  it("counts problems, tips and hidden pages", () => {
    const broken = auditItem(item({ summary: "", imageAssetId: IMG }, {}, { id: "p" }));
    const tip = auditItem(item({ imageAssetId: IMG }, { metaDescription: "short" }, { id: "t" }));
    const hidden = auditItem(item({ imageAssetId: IMG }, { noindex: true }, { id: "h" }));
    expect(summarize([broken, tip, hidden])).toEqual({
      total: 3,
      withProblems: 1,
      withWarnings: 1,
      hidden: 1,
    });
  });
});
