import { siteConfig } from "@/config/site";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout({
  heading,
  intro,
  actionLabel,
  url,
  footnote,
}: {
  heading: string;
  intro: string;
  actionLabel: string;
  url: string;
  footnote: string;
}): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#f3efe7;font-family:Roboto,Arial,sans-serif;color:#121310;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" style="max-width:520px;background:#fbf9f5;border:1px solid #d8cfbf;border-radius:12px;" cellpadding="0" cellspacing="0"><tr><td style="padding:32px;">
<p style="margin:0 0 24px;font-size:15px;font-weight:700;">${escapeHtml(siteConfig.name)}</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;">${escapeHtml(heading)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3b3a33;">${escapeHtml(intro)}</p>
<p style="margin:0 0 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#121310;color:#fbf9f5;text-decoration:none;font-size:15px;font-weight:500;padding:12px 20px;border-radius:8px;">${escapeHtml(actionLabel)}</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6a655b;">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all;">${escapeHtml(url)}</span></p>
<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#6a655b;">${escapeHtml(footnote)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function verificationEmail({ name, url }: { name: string; url: string }): EmailContent {
  const intro = `Hi ${name}, confirm this email address to finish setting up your ${siteConfig.name} account.`;
  const footnote = "This link expires in 1 hour. If you didn't expect this email, you can ignore it.";
  return {
    subject: `Confirm your email for ${siteConfig.name}`,
    html: layout({ heading: "Confirm your email", intro, actionLabel: "Confirm email", url, footnote }),
    text: `${intro}\n\n${url}\n\n${footnote}`,
  };
}

export function passwordResetEmail({ name, url }: { name: string; url: string }): EmailContent {
  const intro = `Hi ${name}, we received a request to reset your ${siteConfig.name} password.`;
  const footnote =
    "This link expires in 1 hour. If you didn't request a reset, ignore this email: your password stays the same.";
  return {
    subject: `Reset your ${siteConfig.name} password`,
    html: layout({
      heading: "Reset your password",
      intro,
      actionLabel: "Choose a new password",
      url,
      footnote,
    }),
    text: `${intro}\n\n${url}\n\n${footnote}`,
  };
}
