import { describe, expect, it } from "vitest";
import { buildContent, isInternalPath } from "@/features/notifications/content";
import { KIND_CATEGORY, NOTIFICATION_KINDS } from "@/features/notifications/types";
import { MAX_MESSAGE_LENGTH, canClientMessage, cleanMessageBody } from "@/features/messages/rules";
import { SEND_FIELDS, pickFields, sendMessageSchema } from "@/features/messages/schema";

const ID = "64b7f1c2a3d4e5f60718293a";

describe("tidying a message", () => {
  it("normalises line endings and spacing", () => {
    expect(cleanMessageBody("  Hello  \r\nworld\r\n\r\n\r\n\r\nBye  ")).toBe("Hello\nworld\n\nBye");
    expect(cleanMessageBody("a \t\nb")).toBe("a\nb");
  });

  it("removes control characters but keeps normal text, other alphabets and emoji", () => {
    expect(cleanMessageBody("a\u0000b\u0007c\u001bd\u007fe")).toBe("abcde");
    expect(cleanMessageBody("سلام 👋 hello")).toBe("سلام 👋 hello");
  });

  it("leaves markup as plain words (it is only ever drawn as text)", () => {
    expect(cleanMessageBody('<script>alert(1)</script> <img src=x onerror="y">')).toBe(
      '<script>alert(1)</script> <img src=x onerror="y">',
    );
  });

  it("turns an all-blank message into an empty one", () => {
    expect(cleanMessageBody("  \n\t\n  ")).toBe("");
  });
});

describe("sending a message", () => {
  it("accepts a normal message and cleans it", () => {
    const parsed = sendMessageSchema.parse({ projectId: ID, body: "  Looks good!\r\n  " });
    expect(parsed.body).toBe("Looks good!");
  });

  it("refuses empty and too-long messages with a plain reason", () => {
    const empty = sendMessageSchema.safeParse({ projectId: ID, body: "   \n " });
    expect(empty.success).toBe(false);
    if (!empty.success) expect(empty.error.issues[0].message).toBe("Write a message first.");
    expect(sendMessageSchema.safeParse({ projectId: ID, body: "x".repeat(MAX_MESSAGE_LENGTH) }).success).toBe(
      true,
    );
    expect(
      sendMessageSchema.safeParse({ projectId: ID, body: "x".repeat(MAX_MESSAGE_LENGTH + 1) }).success,
    ).toBe(false);
    expect(
      sendMessageSchema.safeParse({ projectId: ID, body: "x".repeat(MAX_MESSAGE_LENGTH * 2 + 1) }).success,
    ).toBe(false);
  });

  it("only accepts the project and the text, so a sender can't claim to be someone else", () => {
    expect(sendMessageSchema.safeParse({ projectId: "nope", body: "hi" }).success).toBe(false);
    for (const extra of [
      { authorType: "staff" },
      { organizationId: "x" },
      { authorId: "y" },
      { authorName: "Boss" },
    ]) {
      expect(sendMessageSchema.safeParse({ projectId: ID, body: "hi", ...extra }).success).toBe(false);
    }
    const fd = new FormData();
    fd.set("projectId", ID);
    fd.set("body", "hi");
    fd.set("authorType", "staff");
    fd.set("$ACTION_ID_x", "1");
    expect(Object.keys(pickFields(fd, SEND_FIELDS)).sort()).toEqual(["body", "projectId"]);
  });
});

describe("which projects clients may write on", () => {
  it("allows every status except cancelled", () => {
    for (const status of ["planning", "active", "on_hold", "completed"])
      expect(canClientMessage(status), status).toBe(true);
    expect(canClientMessage("cancelled")).toBe(false);
  });
});

describe("message notifications", () => {
  it("exist for both sides, in the messages category", () => {
    expect(NOTIFICATION_KINDS).toContain("message_from_team");
    expect(NOTIFICATION_KINDS).toContain("message_from_client");
    expect(KIND_CATEGORY.message_from_team).toBe("messages");
    expect(KIND_CATEGORY.message_from_client).toBe("messages");
  });

  it("send clients to the portal conversation and staff to the admin one, with generic wording", () => {
    const toClient = buildContent("message_from_team", { projectId: ID, label: "Booking platform" });
    expect(toClient).toMatchObject({
      title: "New message from your team",
      href: `/portal/projects/${ID}/messages`,
    });
    const toStaff = buildContent("message_from_client", { projectId: ID, label: "Booking platform" });
    expect(toStaff).toMatchObject({
      title: "New message from a client",
      href: `/admin/projects/${ID}/messages`,
    });
    for (const content of [
      toClient,
      toStaff,
      buildContent("message_from_team", {}),
      buildContent("message_from_client", {}),
    ]) {
      expect(isInternalPath(content.href)).toBe(true);
    }
  });
});
