import { isRole } from "@/server/policies/permissions";

export const CATEGORIES = ["proposals", "projects", "deliverables", "files", "leads", "team"] as const;
export type Category = (typeof CATEGORIES)[number];

export const NOTIFICATION_KINDS = [
  "proposal_sent",
  "proposal_accepted",
  "proposal_declined",
  "review_requested",
  "review_approved",
  "review_changes_requested",
  "file_shared",
  "project_started",
  "project_status",
  "added_to_project",
  "new_request",
  "new_lead",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const KIND_CATEGORY: Record<NotificationKind, Category> = {
  proposal_sent: "proposals",
  proposal_accepted: "proposals",
  proposal_declined: "proposals",
  review_requested: "deliverables",
  review_approved: "deliverables",
  review_changes_requested: "deliverables",
  file_shared: "files",
  project_started: "projects",
  project_status: "projects",
  added_to_project: "team",
  new_request: "leads",
  new_lead: "leads",
};

const CLIENT_CATEGORIES: readonly Category[] = ["proposals", "projects", "deliverables", "files"];
const STAFF_CATEGORIES: readonly Category[] = ["leads", "proposals", "deliverables", "team"];

/** The kinds of notification a person can receive, by role. */
export function categoriesFor(role: unknown): readonly Category[] {
  if (role === "client") return CLIENT_CATEGORIES;
  return isRole(role) ? STAFF_CATEGORIES : [];
}

const CATEGORY_TEXT: Record<
  "client" | "staff",
  Partial<Record<Category, { label: string; description: string }>>
> = {
  client: {
    proposals: { label: "Proposals", description: "When we send you a proposal." },
    projects: { label: "Projects", description: "When a project starts or its status changes." },
    deliverables: { label: "Deliverables", description: "When something is ready for your review." },
    files: { label: "Files", description: "When we share a file with you." },
  },
  staff: {
    leads: { label: "Leads", description: "New enquiries and project requests." },
    proposals: { label: "Proposals", description: "When a client accepts or declines a proposal." },
    deliverables: { label: "Deliverables", description: "When a client approves or asks for changes." },
    team: { label: "Team", description: "When you are added to a project." },
  },
};

export function categoryText(role: unknown, category: Category): { label: string; description: string } {
  return (
    CATEGORY_TEXT[role === "client" ? "client" : "staff"][category] ?? { label: category, description: "" }
  );
}

export type EmailPreferences = Partial<Record<Category, boolean>>;

/** Clients get email for everything. Staff only for new leads and proposal answers, unless they choose otherwise. */
export function defaultEmail(role: unknown, category: Category): boolean {
  if (role === "client") return true;
  return category === "leads" || category === "proposals";
}

export function wantsEmail(role: unknown, category: Category, stored?: EmailPreferences | null): boolean {
  if (!categoriesFor(role).includes(category)) return false;
  const chosen = stored && Object.hasOwn(stored, category) ? stored[category] : undefined;
  return typeof chosen === "boolean" ? chosen : defaultEmail(role, category);
}

export interface NotificationView {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

export type PreferencesState =
  { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

export const initialPreferencesState: PreferencesState = { status: "idle" };
