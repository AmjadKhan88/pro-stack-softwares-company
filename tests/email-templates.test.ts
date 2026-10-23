import { describe, expect, it } from "vitest";
import { escapeHtml, passwordResetEmail, verificationEmail } from "@/server/email/templates";

describe("email templates", () => {
  it("escapes HTML in names and urls so user data cannot inject markup", () => {
    const mail = verificationEmail({ name: "<script>alert(1)</script>", url: 'https://x.test/?a="b"&c=<d>' });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("&quot;");
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("includes the link in both html and plain text, and says it expires", () => {
    const url = "https://example.com/reset?token=abc";
    const mail = passwordResetEmail({ name: "Ayesha", url });
    expect(mail.text).toContain(url);
    expect(mail.html).toContain(url);
    expect(mail.text).toMatch(/expires in 1 hour/);
  });
});
