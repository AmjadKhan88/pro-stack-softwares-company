import { NextResponse } from "next/server";
import { signRealtimeToken } from "@/lib/realtime/token";
import { realtimeConfig } from "@/server/realtime/emit";
import { liveProjectsFor } from "@/server/realtime/projects";
import { getCurrentUser } from "@/server/auth/session";
import { hashIdentifier } from "@/server/security/ip";
import { consumeRateLimit } from "@/server/security/rate-limit";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Gives a signed-in person a 15-minute ticket for the live service. 503 means live updates aren't set up. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401, headers: NO_STORE });

  const config = realtimeConfig();
  if (!config)
    return NextResponse.json({ error: "Live updates are not set up." }, { status: 503, headers: NO_STORE });

  const limit = await consumeRateLimit({
    scope: "realtime-token",
    identifier: hashIdentifier(user.id),
    limit: 60,
    windowSeconds: 60,
  });
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: NO_STORE });

  const projects = await liveProjectsFor(user);
  const { token, expiresAt } = signRealtimeToken({ sub: user.id, projects }, config.tokenSecret);
  return NextResponse.json({ token, url: config.url, expiresAt }, { headers: NO_STORE });
}
