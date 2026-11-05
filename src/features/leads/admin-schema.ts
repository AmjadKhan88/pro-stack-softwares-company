import { z } from "zod";
import { isObjectId } from "@/lib/object-id";
import { LEAD_STATUSES, isLeadStatus, type LeadStatus } from "./pipeline";

export { pickFields } from "@/lib/form-fields";

export const PAGE_SIZE = 20;

export interface LeadFilters {
  status?: LeadStatus;
  q?: string;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Reads ?status=&q=&page= defensively: anything invalid is ignored rather than trusted. */
export function parseLeadFilters(params: RawParams): LeadFilters {
  const rawStatus = first(params.status);
  const q = (first(params.q) ?? "").trim().slice(0, 100);
  const pageNumber = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    status: isLeadStatus(rawStatus) ? rawStatus : undefined,
    q: q || undefined,
    page: Number.isFinite(pageNumber) && pageNumber >= 1 ? Math.min(pageNumber, 10_000) : 1,
  };
}

/** Builds a link to the leads list that keeps the current filters. */
export function leadsHref(filters: LeadFilters, overrides: Partial<LeadFilters> = {}): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (merged.status) params.set("status", merged.status);
  if (merged.q) params.set("q", merged.q);
  if (merged.page > 1) params.set("page", String(merged.page));
  const query = params.toString();
  return query ? `/admin/leads?${query}` : "/admin/leads";
}

/** Makes user search text safe to use inside a regular expression. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
const objectId = z.string().refine(isObjectId, "Invalid lead.");

export const statusChangeSchema = z.strictObject({
  leadId: objectId,
  to: z.enum(LEAD_STATUSES, { error: "Choose a status." }),
  note: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
  ),
});

export const noteSchema = z.strictObject({
  leadId: objectId,
  body: z.string().trim().min(1, "Write a note first.").max(2000, "Keep notes under 2,000 characters."),
});

export const leadIdSchema = z.strictObject({ leadId: objectId });

export const STATUS_CHANGE_FIELDS = ["leadId", "to", "note"] as const;
export const NOTE_FIELDS = ["leadId", "body"] as const;
export const LEAD_ID_FIELDS = ["leadId"] as const;
