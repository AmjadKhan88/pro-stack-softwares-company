import { getServerEnv } from "@/lib/env";
import { logger } from "@/server/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends through Resend when RESEND_API_KEY is set. Without a key:
 * - development: prints the email (including its link) to the server console, nothing is sent;
 * - production: throws, so a missing key can never look like success.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const env = getServerEnv();

  if (env.RESEND_API_KEY) {
    if (!env.EMAIL_FROM)
      throw new Error("EMAIL_FROM is required when RESEND_API_KEY is set (see ENVIRONMENT.md).");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Resend rejected the email (HTTP ${response.status}): ${(await response.text()).slice(0, 200)}`,
      );
    }
    return;
  }

  if (env.NODE_ENV === "production") {
    throw new Error("RESEND_API_KEY is not set, so emails cannot be sent in production.");
  }

  console.info(
    `\n=== DEV EMAIL (RESEND_API_KEY not set: nothing was sent) ===\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n============================================================\n`,
  );
}

/** Runs delivery after the response is sent, so request timing never reveals whether an account exists. */
export async function sendEmailInBackground(message: EmailMessage): Promise<void> {
  const task = sendEmail(message).catch((error: unknown) => {
    logger.error({ err: error, subject: message.subject }, "email delivery failed");
  });
  try {
    const { after } = await import("next/server");
    after(task);
  } catch {
    // Not inside a Next.js request (e.g. a script): the task is already running.
  }
}
