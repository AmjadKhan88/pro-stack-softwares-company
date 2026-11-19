// Content types, statuses and shapes. Pure (no I/O) so every rule is easy to read and to test.

export const CONTENT_TYPES = ["service", "case_study"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export interface ContentTypeInfo {
  singular: string;
  plural: string;
  adminPath: string;
  publicPath: string;
  /** Cache tag: publishing refreshes every public page that reads this type. */
  tag: string;
}

export const CONTENT_TYPE_INFO: Record<ContentType, ContentTypeInfo> = {
  service: {
    singular: "Service",
    plural: "Services",
    adminPath: "/admin/content/services",
    publicPath: "/services",
    tag: "content:service",
  },
  case_study: {
    singular: "Case study",
    plural: "Case studies",
    adminPath: "/admin/content/projects",
    publicPath: "/work",
    tag: "content:case_study",
  },
};

export function isContentType(value: unknown): value is ContentType {
  return typeof value === "string" && (CONTENT_TYPES as readonly string[]).includes(value);
}

export const CONTENT_STATUSES = ["draft", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function isContentStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && (CONTENT_STATUSES as readonly string[]).includes(value);
}

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const CONTENT_STATUS_TONE: Record<ContentStatus, "draft" | "live" | "archived"> = {
  draft: "draft",
  published: "live",
  archived: "archived",
};

// published -> published is "publish changes" (republish). Archived items must be restored first.
const MOVES: Record<ContentStatus, readonly ContentStatus[]> = {
  draft: ["published", "archived"],
  published: ["published", "draft"],
  archived: ["draft"],
};

export function canMoveContent(from: ContentStatus, to: ContentStatus): boolean {
  return MOVES[from].includes(to);
}

export function isEditable(status: ContentStatus): boolean {
  return status !== "archived";
}

export interface SeoData {
  metaTitle?: string;
  metaDescription?: string;
  noindex: boolean;
}

export interface ServiceData {
  title: string;
  summary: string;
  description: string;
  deliverables: string[];
}

export interface CaseStudyData {
  title: string;
  category: string;
  summary: string;
  challenge: string;
  approach: string;
  features: string[];
  stack: string[];
  /** Only real, verified results. Shown publicly only when outcomesVerified is true. */
  outcomes: string[];
  outcomesVerified: boolean;
  serviceSlug?: string;
}

export type ContentData = ServiceData | CaseStudyData;

export type ContentEvent =
  "created" | "saved" | "published" | "unpublished" | "archived" | "unarchived" | "restored";

export const CONTENT_EVENT_LABELS: Record<ContentEvent, string> = {
  created: "Created",
  saved: "Draft saved",
  published: "Published",
  unpublished: "Unpublished",
  archived: "Archived",
  unarchived: "Restored from archive",
  restored: "Earlier version restored",
};
