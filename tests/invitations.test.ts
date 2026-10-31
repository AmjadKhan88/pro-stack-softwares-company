import { describe, expect, it } from "vitest";
import { redactMetadata } from "@/features/audit/redact";
import { acceptSchema, inviteSchema, pickFields, INVITE_FIELDS } from "@/features/invitations/schema";
import {
  INVITABLE_ROLES,
  describeInviteState,
  invitableRolesFor,
  isInviteUsable,
} from "@/features/invitations/rules";
import { generateInviteToken, hashInviteToken } from "@/features/invitations/tokens";
import { invitationEmail } from "@/server/email/templates";

describe("who may invite which role", () => {
  it("never allows inviting an owner", () => {
    expect(INVITABLE_ROLES).not.toContain("owner");
    expect(invitableRolesFor("owner")).not.toContain("owner");
  });

  it("lets the owner invite admins, but not admins", () => {
    expect(invitableRolesFor("owner")).toContain("admin");
    expect(invitableRolesFor("admin")).not.toContain("admin");
    expect(invitableRolesFor("admin")).toEqual(expect.arrayContaining(["support", "client", "developer"]));
  });

  it("gives every other role and unknown roles nothing", () => {
    for (const role of [
      "project_manager",
      "developer",
      "content_manager",
      "support",
      "client",
      undefined,
      "root",
    ]) {
      expect(invitableRolesFor(role)).toEqual([]);
    }
  });
});

describe("invitation tokens", () => {
  it("are long, URL-safe and unique", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateInviteToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("are stored only as a deterministic one-way hash", () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(token)).not.toContain(token);
  });
});

describe("invitation lifecycle", () => {
  const now = new Date("2026-01-10T00:00:00Z");
  const future = new Date("2026-01-11T00:00:00Z");
  const past = new Date("2026-01-09T00:00:00Z");

  it("is usable only while pending and unexpired", () => {
    expect(isInviteUsable({ status: "pending", expiresAt: future }, now)).toBe(true);
    expect(isInviteUsable({ status: "pending", expiresAt: past }, now)).toBe(false);
    expect(isInviteUsable({ status: "accepted", expiresAt: future }, now)).toBe(false);
    expect(isInviteUsable({ status: "revoked", expiresAt: future }, now)).toBe(false);
  });

  it("describes the state for the admin table", () => {
    expect(describeInviteState({ status: "pending", expiresAt: past }, now)).toBe("expired");
    expect(describeInviteState({ status: "pending", expiresAt: future }, now)).toBe("pending");
    expect(describeInviteState({ status: "revoked", expiresAt: future }, now)).toBe("revoked");
  });
});

describe("invitation input validation", () => {
  it("normalises emails and rejects owner/unknown roles and unexpected fields", () => {
    expect(inviteSchema.parse({ email: " Ayesha@Example.com ", role: "client" }).email).toBe(
      "ayesha@example.com",
    );
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "owner" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "superuser" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "nope", role: "client" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "client", isAdmin: true }).success).toBe(false);
  });

  it("requires a strong, confirmed password when accepting", () => {
    const base = {
      token: "t".repeat(43),
      name: "Ayesha",
      password: "a-long-enough-password",
      confirm: "a-long-enough-password",
    };
    expect(acceptSchema.safeParse(base).success).toBe(true);
    expect(acceptSchema.safeParse({ ...base, password: "short", confirm: "short" }).success).toBe(false);
    expect(acceptSchema.safeParse({ ...base, confirm: "different-password-123" }).success).toBe(false);
    expect(acceptSchema.safeParse({ ...base, role: "owner" }).success).toBe(false);
  });

  it("ignores framework and unknown form entries", () => {
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("role", "client");
    fd.set("$ACTION_ID_x", "1");
    fd.set("isAdmin", "true");
    expect(pickFields(fd, INVITE_FIELDS)).toEqual({ email: "a@b.com", role: "client" });
  });
});

describe("audit metadata redaction", () => {
  it("masks secrets at any depth and cuts long strings", () => {
    const result = redactMetadata({
      email: "a@b.com",
      password: "hunter2",
      nested: { resetToken: "abc", twoFactorCode: "123456", fine: "ok" },
      list: [{ secretKey: "x" }],
      note: "x".repeat(900),
    }) as Record<string, unknown>;
    expect(result.password).toBe("[redacted]");
    expect((result.nested as Record<string, unknown>).resetToken).toBe("[redacted]");
    expect((result.nested as Record<string, unknown>).twoFactorCode).toBe("[redacted]");
    expect((result.nested as Record<string, unknown>).fine).toBe("ok");
    expect((result.list as Record<string, unknown>[])[0].secretKey).toBe("[redacted]");
    expect((result.note as string).length).toBeLessThan(510);
    expect(result.email).toBe("a@b.com");
  });
});

describe("invitation email", () => {
  it("states who invited, the role, the link and the expiry", () => {
    const mail = invitationEmail({
      roleLabel: "Client",
      url: "https://example.com/accept-invite?token=abc",
      inviterName: "Amjad",
    });
    expect(mail.text).toContain("Amjad invited you");
    expect(mail.text).toContain("as Client");
    expect(mail.text).toContain("https://example.com/accept-invite?token=abc");
    expect(mail.text).toMatch(/expires in 7 days/);
  });
});
