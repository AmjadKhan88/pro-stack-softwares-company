"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useRealtimeEvent } from "@/components/realtime/realtime-provider";

/** A bell with the number of unread notifications. Updates instantly when live updates are on; otherwise every minute. */
export function NotificationBell({ href }: { href: string }) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/summary", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { unread?: number };
      if (typeof data.unread === "number") setUnread(data.unread);
    } catch {
      /* offline: keep the last number */
    }
  }, []);

  useEffect(() => {
    void refresh();
    // The always-on fallback, in case live updates are off or paused.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // The live hint says "something new"; the number itself is always re-read from the website.
  useRealtimeEvent("notification.created", () => void refresh());
  useRealtimeEvent("resync", () => void refresh());

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
