import { can, type Permission } from "@/server/policies/permissions";
export type NavIconName =
  | "dashboard"
  | "projects"
  | "files"
  | "inbox"
  | "users"
  | "proposals"
  | "content"
  | "media"
  | "seo"
  | "notifications"
  | "settings"
  | "audit";

export interface NavItem {
  label: string;
  href: string;
  icon?: NavIconName;
  /** Only routes that exist and work are `ready`. Others render as disabled with a reason. */
  ready: boolean;
  phase?: number;
  /** Show this item only to roles that hold at least one of these permissions. */
  anyOf?: Permission[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const publicNav: NavItem[] = [
  { label: "Home", href: "/", ready: true },
  { label: "Services", href: "/services", ready: true },
  { label: "Work", href: "/work", ready: true },
  { label: "Process", href: "/process", ready: true },
  { label: "About", href: "/about", ready: true },
  { label: "FAQ", href: "/faq", ready: true },
  { label: "Contact", href: "/contact", ready: true },
];

export const portalNav: NavGroup[] = [
  {
    label: "Your projects",
    items: [
      { label: "Overview", href: "/portal", icon: "dashboard", ready: true },
      { label: "Projects", href: "/portal/projects", icon: "projects", ready: true },
      { label: "Proposals", href: "/portal/proposals", icon: "proposals", ready: true },
      { label: "Requests", href: "/portal/requests", icon: "inbox", ready: true },
      { label: "Files", href: "/portal/files", icon: "files", ready: false, phase: 6 },
    ],
  },
  {
    label: "Account",
    items: [
      {
        label: "Notifications",
        href: "/portal/notifications",
        icon: "notifications",
        ready: false,
        phase: 7,
      },
      { label: "Support", href: "/portal/support", icon: "inbox", ready: false, phase: 7 },
      { label: "Security", href: "/portal/security", icon: "settings", ready: false, phase: 3 },
    ],
  },
];

export const adminNav: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/admin", icon: "dashboard", ready: true },
      {
        label: "Projects",
        href: "/admin/projects",
        icon: "projects",
        ready: true,
        anyOf: ["projects.read.all", "projects.read.assigned"],
      },
      {
        label: "Messages",
        href: "/admin/messages",
        icon: "inbox",
        ready: false,
        phase: 7,
        anyOf: ["projects.read.all"],
      },
    ],
  },
  {
    label: "Clients",
    items: [
      { label: "Leads", href: "/admin/leads", icon: "inbox", ready: true, anyOf: ["leads.read"] },
      { label: "Clients", href: "/admin/clients", icon: "users", ready: true, anyOf: ["clients.manage"] },
      {
        label: "Proposals",
        href: "/admin/proposals",
        icon: "proposals",
        ready: true,
        anyOf: ["proposals.manage"],
      },
    ],
  },
  {
    label: "Website",
    items: [
      {
        label: "Services",
        href: "/admin/content/services",
        icon: "content",
        ready: true,
        anyOf: ["content.edit"],
      },
      {
        label: "Case studies",
        href: "/admin/content/projects",
        icon: "content",
        ready: true,
        anyOf: ["content.edit"],
      },
      {
        label: "Media",
        href: "/admin/media",
        icon: "media",
        ready: false,
        phase: 6,
        anyOf: ["content.edit"],
      },
      { label: "SEO", href: "/admin/seo", icon: "seo", ready: false, phase: 6, anyOf: ["content.edit"] },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Users & roles", href: "/admin/users", icon: "users", ready: true, anyOf: ["users.manage"] },
      { label: "Audit log", href: "/admin/audit-logs", icon: "audit", ready: true, anyOf: ["audit.read"] },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: "settings",
        ready: false,
        phase: 6,
        anyOf: ["settings.manage"],
      },
    ],
  },
];

/** Hides the items a role has no permission for, and any group left empty. The server still checks every page. */
export function filterNavForRole(groups: NavGroup[], role: unknown): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.anyOf || item.anyOf.some((permission) => can(role, permission)),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
