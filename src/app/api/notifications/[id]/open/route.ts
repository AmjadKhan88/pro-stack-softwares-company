import { NextResponse } from "next/server";
import { isInternalPath } from "@/features/notifications/content";
import { markRead } from "@/features/notifications/service";
import { getCurrentUser } from "@/server/auth/session";

/** Marks a notification as read and sends the person to what it is about. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const inbox = user.role === "client" ? "/portal/notifications" : "/admin/notifications";
  const href = await markRead(user.id, id); // someone else's notification finds nothing
  // Only ever a path on this website, so this can never be used to send people elsewhere.
  const target = href && isInternalPath(href) ? href : inbox;
  return NextResponse.redirect(new URL(target, request.url), 303);
}
