import { NextResponse } from "next/server";
import { dispatchPendingEmails, releaseStaleClaims } from "@/features/notifications/email";
import { isAuthorizedJob } from "@/features/notifications/job-auth";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/server/logger";

async function run(request: Request) {
  const secret = getServerEnv().JOBS_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  if (!isAuthorizedJob(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  try {
    await releaseStaleClaims();
    return NextResponse.json({ ok: true, ...(await dispatchPendingEmails(100)) });
  } catch (error) {
    logger.error({ err: error }, "notification email job failed");
    return NextResponse.json({ error: "The job failed." }, { status: 500 });
  }
}

// The safety net: a scheduler calls this every few minutes (see ENVIRONMENT.md). Most emails are sent sooner.
export const GET = run;
export const POST = run;
