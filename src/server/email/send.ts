import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { siteConfig } from "@/config/site";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/server/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(user: string, pass: string): Transporter {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass: pass.replace(/\s+/g, ""),
      },
    });
  }
  return cachedTransporter;
}

/**
 * Sends through Gmail SMTP when GMAIL_USER and GMAIL_APP_PASSWORD are set. Without credentials:
 * - development: prints the email (including its link) to the server console, nothing is sent;
 * - production: throws, so missing credentials can never look like success.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const env = getServerEnv();

  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    const from = env.EMAIL_FROM
      ? env.EMAIL_FROM.includes("<")
        ? env.EMAIL_FROM
        : `"${siteConfig.name}" <${env.EMAIL_FROM}>`
      : `"${siteConfig.name}" <${env.GMAIL_USER}>`;

    const mailer = getTransporter(env.GMAIL_USER, env.GMAIL_APP_PASSWORD);
    await mailer.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return;
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD must be set in production to send emails (see ENVIRONMENT.md).",
    );
  }

  console.info(
    `\n=== DEV EMAIL (Gmail credentials not set: nothing was sent) ===\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n============================================================\n`,
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
