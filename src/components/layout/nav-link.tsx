"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Briefcase,
  FileText,
  Files,
  FolderOpen,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  ScrollText,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName, NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

const icons: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  projects: Briefcase,
  files: FolderOpen,
  inbox: Inbox,
  users: Users,
  proposals: FileText,
  content: Files,
  media: ImageIcon,
  seo: Search,
  notifications: Bell,
  settings: Settings,
  audit: ScrollText,
};

export type NavVariant = "light" | "dark" | "top";

const styles: Record<NavVariant, { base: string; active: string; idle: string; disabled: string }> = {
  light: {
    base: "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
    active: "bg-primary text-primary-foreground font-medium",
    idle: "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
    disabled: "text-muted-foreground/60",
  },
  dark: {
    base: "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
    active: "bg-bone-100 text-ink-950 font-medium",
    idle: "text-bone-300 hover:bg-bone-50/10 hover:text-bone-50",
    disabled: "text-bone-400/60",
  },
  top: {
    base: "rounded-md px-3 py-2 text-sm",
    active: "font-semibold text-foreground",
    idle: "text-muted-foreground hover:text-foreground",
    disabled: "text-muted-foreground/60",
  },
};

export function NavLink({
  item,
  variant,
  exact = true,
}: {
  item: NavItem;
  variant: NavVariant;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const s = styles[variant];
  const Icon = item.icon ? icons[item.icon] : null;
  const content = (
    <>
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
      <span>{item.label}</span>
    </>
  );

  if (!item.ready) {
    return (
      <span
        aria-disabled="true"
        title={`Planned for Phase ${item.phase ?? "later"}`}
        className={cn(s.base, s.disabled, "cursor-not-allowed select-none")}
      >
        {content}
        <span className="sr-only"> (not available yet)</span>
      </span>
    );
  }

  const active = exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(s.base, active ? s.active : s.idle)}
    >
      {content}
    </Link>
  );
}
