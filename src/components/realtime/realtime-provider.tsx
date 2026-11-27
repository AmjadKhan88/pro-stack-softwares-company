"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

export type LiveStatus = "off" | "connecting" | "live" | "offline";
export type LiveListener = (data: Record<string, string>) => void;

interface RealtimeValue {
  status: LiveStatus;
  subscribe: (event: string, listener: LiveListener) => () => void;
  joinProject: (projectId: string) => () => void;
}

// Without a provider (or without live updates) everything simply does nothing.
const fallback: RealtimeValue = {
  status: "off",
  subscribe: () => () => undefined,
  joinProject: () => () => undefined,
};
const RealtimeContext = createContext<RealtimeValue>(fallback);

interface TokenResponse {
  token: string;
  url: string;
}

async function fetchToken(): Promise<TokenResponse | "unavailable"> {
  const response = await fetch("/api/realtime/token", { cache: "no-store" });
  if (response.status === 503) return "unavailable";
  if (!response.ok) throw new Error("ticket refused");
  return (await response.json()) as TokenResponse;
}

/** One live connection for the whole dashboard. If it can't connect, pages keep refreshing on their own. */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const listeners = useRef(new Map<string, Set<LiveListener>>());
  const rooms = useRef(new Map<string, number>());
  const socketRef = useRef<Socket | null>(null);

  const dispatch = useCallback((event: string, data: Record<string, string>) => {
    listeners.current.get(event)?.forEach((listener) => listener(data));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let connectedBefore = false;

    async function start() {
      try {
        const first = await fetchToken();
        if (cancelled) return;
        if (first === "unavailable") {
          setStatus("off");
          return;
        }
        const { io } = await import("socket.io-client");
        if (cancelled) return;

        let pending: TokenResponse | null = first;
        const socket = io(first.url, {
          transports: ["websocket"],
          reconnectionDelayMax: 30_000,
          // A fresh ticket for every (re)connection, because tickets expire after 15 minutes.
          auth: (callback) => {
            const ready = pending;
            pending = null;
            void (async () => {
              try {
                const next = ready ?? (await fetchToken());
                callback({ token: next === "unavailable" ? "" : next.token });
              } catch {
                callback({ token: "" });
              }
            })();
          },
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          setStatus("live");
          for (const room of rooms.current.keys()) socket.emit("join", room);
          // After a reconnection, pages re-read what they may have missed.
          if (connectedBefore) dispatch("resync", {});
          connectedBefore = true;
        });
        socket.on("disconnect", (reason) => {
          setStatus("offline");
          if (reason === "io server disconnect") socket.connect(); // ticket expired: connect again with a new one
        });
        socket.on("connect_error", () => {
          setStatus("offline");
          // A refused connection isn't retried automatically, so try again later.
          if (!socket.active) retry = setTimeout(() => !cancelled && socket.connect(), 15_000);
        });
        socket.on("notification.created", (data: Record<string, string>) =>
          dispatch("notification.created", data),
        );
        socket.on("message.created", (data: Record<string, string>) => dispatch("message.created", data));
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [dispatch]);

  const subscribe = useCallback((event: string, listener: LiveListener) => {
    let set = listeners.current.get(event);
    if (!set) {
      set = new Set();
      listeners.current.set(event, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }, []);

  const joinProject = useCallback((projectId: string) => {
    const room = `project:${projectId}`;
    rooms.current.set(room, (rooms.current.get(room) ?? 0) + 1);
    if (socketRef.current?.connected) socketRef.current.emit("join", room);
    return () => {
      const count = (rooms.current.get(room) ?? 1) - 1;
      if (count <= 0) {
        rooms.current.delete(room);
        if (socketRef.current?.connected) socketRef.current.emit("leave", room);
      } else {
        rooms.current.set(room, count);
      }
    };
  }, []);

  const value = useMemo(() => ({ status, subscribe, joinProject }), [status, subscribe, joinProject]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeValue {
  return useContext(RealtimeContext);
}

/** Runs the handler whenever the live service reports this event (or "resync" after a reconnection). */
export function useRealtimeEvent(event: string, handler: LiveListener) {
  const { subscribe } = useRealtime();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => subscribe(event, (data) => latest.current(data)), [event, subscribe]);
}

/** A small dot: green when live updates are on. Hidden when live updates aren't set up. */
export function LiveIndicator() {
  const { status } = useRealtime();
  if (status === "off") return null;
  const live = status === "live";
  const text = live
    ? "Live updates on"
    : status === "connecting"
      ? "Connecting to live updates…"
      : "Live updates paused. Pages still refresh on their own.";
  return (
    <span role="status" title={text} className="inline-flex items-center">
      <span aria-hidden className={`size-2 rounded-full ${live ? "bg-success" : "bg-muted-foreground/50"}`} />
      <span className="sr-only">{text}</span>
    </span>
  );
}
