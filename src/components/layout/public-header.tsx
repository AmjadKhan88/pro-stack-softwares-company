import { siteConfig } from "@/config/site";
import { publicNav } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";

export function PublicHeader() {
  return (
    <header className="border-border bg-background/90 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-8">
        <Brand />
        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
          {publicNav.map((item) => (
            <NavLink key={item.href} item={item} variant="top" />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <ThemeSwitcher className="hidden sm:inline-flex" />
          <Button asChild variant="accent" size="sm" className="hidden sm:inline-flex">
            <a href={`mailto:${siteConfig.email}?subject=Project%20inquiry`}>Start a project</a>
          </Button>
          <MobileNav groups={[{ label: "Menu", items: publicNav }]} variant="light" label="Main menu" />
        </div>
      </div>
    </header>
  );
}
