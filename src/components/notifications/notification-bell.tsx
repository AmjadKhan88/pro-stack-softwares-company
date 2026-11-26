"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

/** A bell with the number of unread notifications. It re-checks every minute and when you return to the tab. */
export function NotificationBell({ href }: { href: string }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const response = await fetch("/api/notifications/summary", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { unread?: number };
        if (alive && typeof data.unread === "number") setUnread(data.unread);
      } catch {
        /* offline: keep the last number */
      }
    }
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <Link
      href={href}
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className="border-border bg-surface text-muted-foreground hover:text-foreground focus-visible:ring-accent/25 relative grid size-9 place-items-center rounded-lg border focus-visible:ring-4 focus-visible:outline-none"
    >
      <Bell className="size-4" aria-hidden />
      {unread > 0 ? (
        <span
          aria-hidden
          className="bg-accent text-accent-foreground absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full px-1 text-[10px] leading-5 font-semibold tabular-nums"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
