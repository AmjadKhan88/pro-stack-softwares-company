import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-id" });
const mockCreateTransport = vi.fn(() => ({ sendMail: mockSendMail }));

vi.mock("server-only", () => ({}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: (...args: unknown[]) => mockCreateTransport(...args),
  },
}));

// We test sendEmail dynamically so each test can vary env
describe("sendEmail with Gmail SMTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends via nodemailer when GMAIL_USER and GMAIL_APP_PASSWORD are provided", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GMAIL_USER", "test@gmail.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
    vi.stubEnv("EMAIL_FROM", "Pro Stack Creations <test@gmail.com>");

    const { sendEmail } = await import("@/server/email/send");

    await sendEmail({
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(mockCreateTransport).toHaveBeenCalledWith({
      service: "gmail",
      auth: {
        user: "test@gmail.com",
        pass: "abcdefghijklmnop",
      },
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: "Pro Stack Creations <test@gmail.com>",
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      text: "Hello",
    });
  });

  it("logs to console without throwing in development when credentials are not configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GMAIL_USER", "");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");

    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { sendEmail } = await import("@/server/email/send");

    await expect(
      sendEmail({
        to: "recipient@example.com",
        subject: "No Auth Test",
        html: "<p>Dev</p>",
        text: "Dev",
      }),
    ).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("DEV EMAIL"));
    consoleSpy.mockRestore();
  });

  it("throws in production when Gmail credentials are not set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GMAIL_USER", "");
    vi.stubEnv("GMAIL_APP_PASSWORD", "");

    const { sendEmail } = await import("@/server/email/send");

    await expect(
      sendEmail({
        to: "recipient@example.com",
        subject: "Prod Fail Test",
        html: "<p>Prod</p>",
        text: "Prod",
      }),
    ).rejects.toThrow(/GMAIL_USER and GMAIL_APP_PASSWORD must be set in production/);
  });
});
