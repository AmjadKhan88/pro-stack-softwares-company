import { connection } from "next/server";

/** Liveness only. Discloses no configuration, versions or secrets. */
export async function GET() {
  await connection(); // opt out of prerendering so this is evaluated per request
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
