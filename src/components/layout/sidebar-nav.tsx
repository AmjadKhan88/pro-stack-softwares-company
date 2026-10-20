import type { NavGroup } from "@/config/navigation";
import { NavLink, type NavVariant } from "./nav-link";
import { cn } from "@/lib/utils";

export function SidebarNav({
  groups,
  variant,
  label,
}: {
  groups: NavGroup[];
  variant: NavVariant;
  label: string;
}) {
  const dark = variant === "dark";
  return (
    <nav aria-label={label} className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
      {groups.map((group) => (
        <div key={group.label}>
          <p
            className={cn(
              "mb-2 px-2.5 text-[11px] font-medium tracking-[0.16em] uppercase",
              dark ? "text-bone-400" : "text-muted-foreground",
            )}
          >
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLink item={item} variant={variant} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
