import type { NotificationKind } from "./types";

export interface ContentFacts {
  /** The main item's id (a proposal, a lead, a project...). */
  id?: string;
  projectId?: string;
  /** A short name to show in the app (a proposal title, a file name...). Never put in emails. */
  label?: string;
  status?: string;
}

const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

/** True only for a path on this website. Used before redirecting anywhere, so it can never send people elsewhere. */
export function isInternalPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 300 &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    // eslint-disable-next-line no-control-regex
    !/[\\\s\u0000-\u001f\u007f]/.test(value)
  );
}

/** The words and link for one kind of notification. Titles are generic on purpose: they are also used in emails. */
export function buildContent(
  kind: NotificationKind,
  facts: ContentFacts,
): { title: string; body: string; href: string } {
  const label = clip((facts.label ?? "").trim(), 160);
  const id = facts.id ?? "";
  const projectId = facts.projectId ?? "";
  const make = (title: string, body: string, href: string) => ({
    title,
    body: clip(body, 200),
    href: isInternalPath(href) ? href : "/",
  });

  switch (kind) {
    case "proposal_sent":
      return make("A new proposal is ready", label, id ? `/portal/proposals/${id}` : "/portal/proposals");
    case "proposal_accepted":
      return make("Proposal accepted", label, id ? `/admin/proposals/${id}` : "/admin/proposals");
    case "proposal_declined":
      return make("Proposal declined", label, id ? `/admin/proposals/${id}` : "/admin/proposals");
    case "review_requested":
      return make(
        "A deliverable is ready for your review",
        label,
        projectId ? `/portal/projects/${projectId}` : "/portal/projects",
      );
    case "review_approved":
      return make(
        "Deliverable approved",
        label,
        projectId ? `/admin/projects/${projectId}` : "/admin/projects",
      );
    case "review_changes_requested":
      return make(
        "Changes requested on a deliverable",
        label,
        projectId ? `/admin/projects/${projectId}` : "/admin/projects",
      );
    case "file_shared":
      return make("A file was shared with you", label, "/portal/files");
    case "project_started":
      return make("Your project has started", label, id ? `/portal/projects/${id}` : "/portal/projects");
    case "project_status":
      return make(
        "Project status updated",
        `${label} is now ${facts.status ?? "updated"}`,
        id ? `/portal/projects/${id}` : "/portal/projects",
      );
    case "added_to_project":
      return make("You were added to a project", label, id ? `/admin/projects/${id}` : "/admin/projects");
    case "new_request":
      return make("New project request", label, id ? `/admin/leads/${id}` : "/admin/leads");
    case "new_lead":
      return make("New enquiry from the website", label, id ? `/admin/leads/${id}` : "/admin/leads");
    case "message_from_team":
      return make(
        "New message from your team",
        label,
        projectId ? `/portal/projects/${projectId}/messages` : "/portal/projects",
      );
    case "message_from_client":
      return make(
        "New message from a client",
        label,
        projectId ? `/admin/projects/${projectId}/messages` : "/admin/projects",
      );
  }
}
