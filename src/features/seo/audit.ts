// What is missing or weak in a page's search settings. Pure (no I/O) so every rule is easy to read and to test.
import { asRecord, str } from "@/features/cms/read-helpers";
import { publicUrlFor, type ContentType } from "@/features/cms/types";

export const SEO_CONTENT_TYPES = ["service", "case_study", "article", "page"] as const;
export type SeoContentType = Extract<ContentType, (typeof SEO_CONTENT_TYPES)[number]>;

export type Severity = "problem" | "warning" | "info";
export interface SeoIssue {
  severity: Severity;
  message: string;
}

export const SEO_MESSAGES = {
  noDescription: "No description at all. Search engines will make one up from the page.",
  summaryUsed: "No custom description. The summary is used instead.",
  descriptionLong: "The description is longer than 160 characters and may be cut off in search results.",
  descriptionShort: "The description is shorter than 50 characters. A fuller one usually works better.",
  titleLong: "The page title is longer than 60 characters and may be cut off in search results.",
  noShareImage: "No sharing image. Links shared on social media will show no picture.",
  shareImageGone: "The chosen sharing image is no longer available (archived or removed).",
  mainImageGone: "The main image is no longer available (archived or removed), so the page shows without it.",
  hidden: "Hidden from search engines, and left out of the sitemap.",
} as const;

export interface SeoItemInput {
  type: SeoContentType;
  id: string;
  /** The live address (published slug). */
  slug: string;
  /** The published snapshot, exactly what visitors see. */
  data: unknown;
  seo: unknown;
  /** Library images that currently exist and are active. */
  availableAssetIds: ReadonlySet<string>;
}

export interface SeoRow {
  id: string;
  type: SeoContentType;
  url: string;
  title: string;
  effectiveTitle: string;
  effectiveDescription: string;
  descriptionSource: "custom" | "summary" | "none";
  shareImage: "own" | "main" | "none";
  indexed: boolean;
  issues: SeoIssue[];
}

const RANK: Record<Severity, number> = { problem: 0, warning: 1, info: 2 };

export function auditItem(input: SeoItemInput): SeoRow {
  const data = asRecord(input.data);
  const seo = asRecord(input.seo);
  const title = str(data.title).trim();
  const metaTitle = str(seo.metaTitle, 70).trim();
  const metaDescription = str(seo.metaDescription, 170).trim();
  const summary = str(data.summary).trim();
  const indexed = seo.noindex !== true;

  const effectiveTitle = metaTitle || title;
  const descriptionSource = metaDescription ? "custom" : summary ? "summary" : "none";
  const effectiveDescription = metaDescription || summary;

  const mainId = typeof data.imageAssetId === "string" ? data.imageAssetId : "";
  const ogId = typeof seo.ogImageAssetId === "string" ? seo.ogImageAssetId : "";
  const ogOk = ogId !== "" && input.availableAssetIds.has(ogId);
  const mainOk = mainId !== "" && input.availableAssetIds.has(mainId);
  const shareImage = ogOk ? "own" : mainOk ? "main" : "none";

  const issues: SeoIssue[] = [];
  if (!indexed) issues.push({ severity: "info", message: SEO_MESSAGES.hidden });

  // Wording that only matters for search results is skipped for pages hidden from search engines.
  if (indexed) {
    if (descriptionSource === "none")
      issues.push({ severity: "problem", message: SEO_MESSAGES.noDescription });
    if (descriptionSource === "summary") issues.push({ severity: "info", message: SEO_MESSAGES.summaryUsed });
    if (effectiveDescription && effectiveDescription.length > 160) {
      issues.push({ severity: "warning", message: SEO_MESSAGES.descriptionLong });
    }
    if (effectiveDescription && effectiveDescription.length < 50) {
      issues.push({ severity: "warning", message: SEO_MESSAGES.descriptionShort });
    }
    if (effectiveTitle.length > 60) issues.push({ severity: "warning", message: SEO_MESSAGES.titleLong });
  }

  if (ogId !== "" && !ogOk) issues.push({ severity: "problem", message: SEO_MESSAGES.shareImageGone });
  if (mainId !== "" && !mainOk) issues.push({ severity: "problem", message: SEO_MESSAGES.mainImageGone });
  if (shareImage === "none" && ogId === "" && mainId === "") {
    issues.push({ severity: "warning", message: SEO_MESSAGES.noShareImage });
  }

  return {
    id: input.id,
    type: input.type,
    url: publicUrlFor(input.type, input.slug),
    title: title || input.slug,
    effectiveTitle,
    effectiveDescription,
    descriptionSource,
    shareImage,
    indexed,
    issues,
  };
}

/** Adds a warning to pages that share the same title or description with another page. Returns new rows. */
export function markDuplicates(rows: SeoRow[]): SeoRow[] {
  const byTitle = new Map<string, SeoRow[]>();
  const byDescription = new Map<string, SeoRow[]>();
  for (const row of rows.filter((r) => r.indexed)) {
    const titleKey = row.effectiveTitle.trim().toLowerCase();
    if (titleKey) byTitle.set(titleKey, [...(byTitle.get(titleKey) ?? []), row]);
    const descriptionKey = row.effectiveDescription.trim().toLowerCase();
    if (descriptionKey)
      byDescription.set(descriptionKey, [...(byDescription.get(descriptionKey) ?? []), row]);
  }
  return rows.map((row) => {
    const extra: SeoIssue[] = [];
    const sameTitle = byTitle.get(row.effectiveTitle.trim().toLowerCase()) ?? [];
    if (row.indexed && row.effectiveTitle && sameTitle.length > 1) {
      const others = sameTitle.filter((r) => r.id !== row.id).map((r) => `"${r.title}"`);
      extra.push({
        severity: "warning",
        message: `Same page title as ${others.join(", ")}. Give each page its own title.`,
      });
    }
    const sameDescription = byDescription.get(row.effectiveDescription.trim().toLowerCase()) ?? [];
    if (row.indexed && row.effectiveDescription && sameDescription.length > 1) {
      const others = sameDescription.filter((r) => r.id !== row.id).map((r) => `"${r.title}"`);
      extra.push({
        severity: "warning",
        message: `Same description as ${others.join(", ")}. Give each page its own.`,
      });
    }
    return extra.length > 0 ? { ...row, issues: [...row.issues, ...extra] } : row;
  });
}

/** Problems first, then warnings, then the rest; alphabetical within each. */
export function sortRows(rows: SeoRow[]): SeoRow[] {
  const worst = (row: SeoRow) => Math.min(3, ...row.issues.map((issue) => RANK[issue.severity]));
  return [...rows]
    .map((row) => ({ ...row, issues: [...row.issues].sort((a, b) => RANK[a.severity] - RANK[b.severity]) }))
    .sort((a, b) => worst(a) - worst(b) || a.title.localeCompare(b.title));
}

export function summarize(rows: SeoRow[]) {
  return {
    total: rows.length,
    withProblems: rows.filter((row) => row.issues.some((issue) => issue.severity === "problem")).length,
    withWarnings: rows.filter(
      (row) =>
        !row.issues.some((issue) => issue.severity === "problem") &&
        row.issues.some((issue) => issue.severity === "warning"),
    ).length,
    hidden: rows.filter((row) => !row.indexed).length,
  };
}
