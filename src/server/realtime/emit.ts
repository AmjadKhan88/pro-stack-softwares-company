import "server-only";
import type { RealtimeMessage } from "@/lib/realtime/contract";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/server/logger";

export interface RealtimeConfig {
  url: string;
  tokenSecret: string;
  emitSecret: string;
}

/** The live service settings, or null when live updates aren't set up (everything then works without them). */
export function realtimeConfig(): RealtimeConfig | null {
  const env = getServerEnv();
  if (!env.REALTIME_URL || !env.REALTIME_TOKEN_SECRET || !env.REALTIME_EMIT_SECRET) return null;
  return {
    url: env.REALTIME_URL.replace(/\/+$/, ""),
    tokenSecret: env.REALTIME_TOKEN_SECRET,
    emitSecret: env.REALTIME_EMIT_SECRET,
  };
}

/** Tells the live service something changed. Best effort: a failure is logged and never affects anyone. */
export async function emitRealtime(messages: RealtimeMessage[]): Promise<void> {
  const config = realtimeConfig();
  if (!config || messages.length === 0) return;
  try {
    const response = await fetch(`${config.url}/emit`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.emitSecret}` },
      body: JSON.stringify({ events: messages.slice(0, 50) }),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!response.ok) logger.warn({ status: response.status }, "the live service refused an update");
  } catch (error) {
    logger.warn({ err: error }, "the live service could not be reached");
  }
}

/** Sends after the current request has finished, so it never slows anyone down. Outside a request it does nothing. */
export function scheduleRealtimeEmit(messages: RealtimeMessage[]): void {
  if (messages.length === 0 || !realtimeConfig()) return;
  void import("next/server")
    .then(({ after }) => {
      try {
        after(() => emitRealtime(messages));
      } catch {
        /* not inside a request */
      }
    })
    .catch(() => undefined);
}
