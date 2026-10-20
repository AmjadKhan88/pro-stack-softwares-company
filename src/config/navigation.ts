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
      { label: "Projects", href: "/portal/projects", icon: "projects", ready: false, phase: 5 },
      { label: "Proposals", href: "/portal/proposals", icon: "proposals", ready: false, phase: 4 },
      { label: "Files", href: "/portal/files", icon: "files", ready: false, phase: 5 },
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
      { label: "Support", href: "/portal/support", icon: "inbox", ready: false, phase: 5 },
      { label: "Security", href: "/portal/security", icon: "settings", ready: false, phase: 3 },
    ],
  },
];

export const adminNav: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/admin", icon: "dashboard", ready: true },
      { label: "Projects", href: "/admin/projects", icon: "projects", ready: false, phase: 4 },
      { label: "Messages", href: "/admin/messages", icon: "inbox", ready: false, phase: 7 },
    ],
  },
  {
    label: "Clients",
    items: [
      { label: "Leads", href: "/admin/leads", icon: "inbox", ready: false, phase: 4 },
      { label: "Clients", href: "/admin/clients", icon: "users", ready: false, phase: 4 },
      { label: "Proposals", href: "/admin/proposals", icon: "proposals", ready: false, phase: 4 },
    ],
  },
  {
    label: "Website",
    items: [
      { label: "Content", href: "/admin/content/pages", icon: "content", ready: false, phase: 6 },
      { label: "Media", href: "/admin/media", icon: "media", ready: false, phase: 6 },
      { label: "SEO", href: "/admin/seo", icon: "seo", ready: false, phase: 6 },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Users & roles", href: "/admin/users", icon: "users", ready: false, phase: 5 },
      { label: "Audit log", href: "/admin/audit-logs", icon: "audit", ready: false, phase: 4 },
      { label: "Settings", href: "/admin/settings", icon: "settings", ready: false, phase: 6 },
    ],
  },
];
