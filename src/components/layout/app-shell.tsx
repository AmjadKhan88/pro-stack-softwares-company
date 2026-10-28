import type { NavGroup } from "@/config/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import type { SessionUser } from "@/server/auth/session";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";
import { cn } from "@/lib/utils";

interface Props {
  variant: "light" | "dark";
  groups: NavGroup[];
  sublabel: string;
  areaLabel: string;
  homeHref: string;
  user: SessionUser;
  children: React.ReactNode;
}

/** Shared dashboard shell. Portal = light sidebar, admin = dark ink sidebar (per design references). */
export function AppShell({ variant, groups, sublabel, areaLabel, homeHref, user, children }: Props) {
  const dark = variant === "dark";
  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col lg:flex",
          dark ? "bg-ink-950 text-bone-100" : "border-border bg-surface border-r",
        )}
      >
        <div className="px-5 pt-6 pb-5">
          <Brand sublabel={sublabel} inverse={dark} href={homeHref} />
        </div>
        <SidebarNav groups={groups} variant={variant} label={`${areaLabel} navigation`} />
        <div
          className={cn(
            "space-y-1 border-t px-5 py-4 text-xs",
            dark ? "border-bone-50/10 text-bone-300" : "border-border text-muted-foreground",
          )}
        >
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate">{user.email}</p>
          <SignOutButton className={dark ? "text-bone-50" : "text-foreground"} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/90 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-md sm:px-8">
          <MobileNav
            groups={groups}
            variant={variant}
            sublabel={sublabel}
            label={`${areaLabel} navigation`}
          />
          <span className="text-sm font-medium">{areaLabel}</span>
          <div className="ml-auto flex items-center gap-3">
            <ThemeSwitcher />
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
