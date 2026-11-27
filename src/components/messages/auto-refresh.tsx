"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRealtime, useRealtimeEvent } from "@/components/realtime/realtime-provider";

/**
 * Keeps a conversation up to date. With live updates on, a new message appears at once; the timer is then only
 * a slow safety net. Without them it re-checks every 20 seconds, as before.
 */
export function AutoRefresh({ projectId, seconds = 20 }: { projectId?: string; seconds?: number }) {
  const router = useRouter();
  const { status, joinProject } = useRealtime();
  const live = status === "live";

  useEffect(() => (projectId ? joinProject(projectId) : undefined), [projectId, joinProject]);
  useRealtimeEvent("message.created", (data) => {
    if (!projectId || data.projectId === projectId) router.refresh();
  });
  useRealtimeEvent("resync", () => router.refresh());

  useEffect(() => {
    const timer = setInterval(
      () => {
        if (document.visibilityState === "visible") router.refresh();
      },
      (live ? seconds * 4 : seconds) * 1000,
    );
    return () => clearInterval(timer);
  }, [router, seconds, live]);

  return null;
}
