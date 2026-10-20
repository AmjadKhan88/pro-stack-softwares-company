"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import type { NavGroup } from "@/config/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { Brand } from "./brand";
import type { NavVariant } from "./nav-link";
import { cn } from "@/lib/utils";

interface Props {
  groups: NavGroup[];
  variant: NavVariant;
  sublabel?: string;
  label: string;
}

export function MobileNav({ groups, variant, sublabel, label }: Props) {
  const [open, setOpen] = useState(false);
  const dark = variant === "dark";
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="border-border bg-surface text-foreground focus-visible:ring-accent/25 grid size-10 place-items-center rounded-lg border focus-visible:ring-4 focus-visible:outline-none lg:hidden"
      >
        <Menu className="size-4" aria-hidden />
      </SheetTrigger>
      <SheetContent
        title={label}
        className={cn(
          dark ? "bg-ink-950 text-bone-100" : "border-border bg-surface text-foreground border-r",
        )}
      >
        <div className="px-5 pt-6 pb-4">
          <Brand sublabel={sublabel} inverse={dark} />
        </div>
        {/* Close the drawer after choosing a destination. */}
        <div
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <SidebarNav groups={groups} variant={variant === "top" ? "light" : variant} label={label} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
