import { z } from "zod";
import { splitLines } from "@/features/proposals/schema";
import { isObjectId } from "@/lib/object-id";
import { isValidSlug } from "./slug";
import type { CaseStudyData, ContentData, ContentType, SeoData, ServiceData } from "./types";

export { pickFields } from "@/lib/form-fields";

/** What a form submits: every value is text. */
export type RawForm = Record<string, string | undefined>;

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
/** An unticked checkbox sends nothing at all, so "absent" means false. */
const checkbox = z.preprocess((value) => value === "on", z.boolean());

const slugField = z
  .string({ error: "Enter a URL slug." })
  .trim()
  .toLowerCase()
  .refine(
    isValidSlug,
    "Use 3 to 80 lowercase letters, numbers and single hyphens, for example web-applications.",
  );

function text(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `Keep ${label} under ${max.toLocaleString("en")} characters.`);
}

/** One item per line; bullet marks and blank lines are dropped. */
function lines(noun: string, maxItems: number, maxLength: number) {
  return z.preprocess(
    (value) => (typeof value === "string" ? splitLines(value) : []),
    z
      .array(z.string().max(maxLength, `Keep each ${noun} under ${maxLength} characters.`))
      .max(maxItems, `Use at most ${maxItems} ${noun}s.`),
  );
}

const optionalText = (max: number, message: string) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, message).optional());

const seoFields = {
  metaTitle: optionalText(70, "Keep the page title under 70 characters."),
  metaDescription: optionalText(170, "Keep the description under 170 characters."),
  noindex: checkbox,
};

const serviceFormSchema = z.strictObject({
  slug: slugField,
  title: z
    .string()
    .trim()
    .min(2, "Give the service a title.")
    .max(120, "Keep the title under 120 characters."),
  summary: text("the summary", 300),
  description: text("the description", 4000),
  deliverables: lines("deliverable", 20, 200),
  ...seoFields,
});

const caseStudyFormSchema = z.strictObject({
  slug: slugField,
  title: z
    .string()
    .trim()
    .min(2, "Give the case study a title.")
    .max(120, "Keep the title under 120 characters."),
  category: text("the category", 60),
  summary: text("the summary", 300),
  challenge: text("the challenge", 3000),
  approach: text("the approach", 3000),
  features: lines("feature", 20, 200),
  stack: lines("technology", 20, 60),
  outcomes: lines("outcome", 10, 300),
  outcomesVerified: checkbox,
  serviceSlug: z.preprocess(emptyToUndefined, slugField.optional()),
  ...seoFields,
});

export interface ParsedContent {
  slug: string;
  data: ContentData;
  seo: SeoData;
}

export type ParseResult =
  { ok: true; value: ParsedContent } | { ok: false; fieldErrors: Record<string, string> };

function failure(error: z.ZodError): { ok: false; fieldErrors: Record<string, string> } {
  const { fieldErrors } = z.flattenError(error);
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const first = (messages as string[] | undefined)?.[0];
    if (first) out[key] = first;
  }
  return { ok: false, fieldErrors: out };
}

/** Checks what an editor typed. Drafts may be incomplete: completeness is checked again when publishing. */
export function parseContentForm(type: ContentType, raw: RawForm): ParseResult {
  if (type === "service") {
    const result = serviceFormSchema.safeParse(raw);
    if (!result.success) return failure(result.error);
    const { slug, metaTitle, metaDescription, noindex, ...data } = result.data;
    return {
      ok: true,
      value: { slug, data: data satisfies ServiceData, seo: { metaTitle, metaDescription, noindex } },
    };
  }
  const result = caseStudyFormSchema.safeParse(raw);
  if (!result.success) return failure(result.error);
  const { slug, metaTitle, metaDescription, noindex, ...data } = result.data;
  return {
    ok: true,
    value: { slug, data: data satisfies CaseStudyData, seo: { metaTitle, metaDescription, noindex } },
  };
}

const SEO_FORM_FIELDS = ["metaTitle", "metaDescription", "noindex"] as const;
export const CONTENT_FORM_FIELDS: Record<ContentType, readonly string[]> = {
  service: ["slug", "title", "summary", "description", "deliverables", ...SEO_FORM_FIELDS],
  case_study: [
    "slug",
    "title",
    "category",
    "summary",
    "challenge",
    "approach",
    "features",
    "stack",
    "outcomes",
    "outcomesVerified",
    "serviceSlug",
    ...SEO_FORM_FIELDS,
  ],
};

/**
 * Everything that must be true before something goes live. Returns plain-language problems (empty = ready).
 * Saving a draft never needs this; publishing always does.
 */
export function validateForPublish(type: ContentType, data: ContentData): string[] {
  const problems: string[] = [];
  const need = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };
  if (type === "service") {
    const d = data as ServiceData;
    need(d.title.trim().length >= 3, "Add a title of at least 3 characters.");
    need(d.summary.trim().length >= 20, "Add a summary of at least 20 characters.");
    need(d.description.trim().length >= 50, "Add a description of at least 50 characters.");
    need(d.deliverables.length >= 1, "Add at least one deliverable.");
    return problems;
  }
  const d = data as CaseStudyData;
  need(d.title.trim().length >= 3, "Add a title of at least 3 characters.");
  need(d.category.trim().length >= 2, "Add a category, for example Web application.");
  need(d.summary.trim().length >= 20, "Add a summary of at least 20 characters.");
  need(d.challenge.trim().length >= 50, "Describe the challenge in at least 50 characters.");
  need(d.approach.trim().length >= 50, "Describe the approach in at least 50 characters.");
  need(d.features.length >= 1, "Add at least one core feature.");
  need(d.stack.length >= 1, "Add at least one technology.");
  need(
    d.outcomes.length === 0 || d.outcomesVerified === true,
    "Tick the box confirming the outcomes are real and verifiable, or remove them.",
  );
  return problems;
}

// ---------------------------------------------------------------- ids for lifecycle actions

const objectId = (message: string) => z.string().refine(isObjectId, message);
const version = z.coerce.number().int().min(1).max(1_000_000);

export const entryIdSchema = z.strictObject({ entryId: objectId("Invalid item.") });
export const entryVersionSchema = z.strictObject({
  entryId: objectId("Invalid item."),
  expectedVersion: version,
});
export const restoreSchema = z.strictObject({
  entryId: objectId("Invalid item."),
  revisionId: objectId("Invalid version."),
  expectedVersion: version,
});

export const ENTRY_ID_FIELDS = ["entryId"] as const;
export const ENTRY_VERSION_FIELDS = ["entryId", "expectedVersion"] as const;
export const RESTORE_FIELDS = ["entryId", "revisionId", "expectedVersion"] as const;
