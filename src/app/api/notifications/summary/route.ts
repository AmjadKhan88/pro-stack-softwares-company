import { NextResponse } from "next/server";
import { countUnread } from "@/features/notifications/service";
import { getCurrentUser } from "@/server/auth/session";

/** The unread count for the signed-in person. The bell asks for this. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json(
    { unread: await countUnread(user.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
