import { describe, expect, it } from "vitest";
import { inviteSchema } from "@/features/invitations/schema";
import { ORGANIZATION_FIELDS, organizationSchema, pickFields } from "@/features/organizations/schema";
import { isObjectId } from "@/lib/object-id";

const ORG_ID = "64b7f1c2a3d4e5f60718293a";

describe("isObjectId", () => {
  it("accepts 24-character hex ids only", () => {
    expect(isObjectId(ORG_ID)).toBe(true);
    for (const bad of [
      "",
      "abc",
      ORG_ID + "0",
      "zzzzzzzzzzzzzzzzzzzzzzzz",
      "../etc/passwd",
      { $ne: null },
      null,
      42,
    ]) {
      expect(isObjectId(bad)).toBe(false);
    }
  });
});

describe("organization input", () => {
  it("accepts a name with an optional contact email", () => {
    expect(organizationSchema.parse({ name: "  Acme Ltd  " })).toEqual({ name: "Acme Ltd" });
    expect(organizationSchema.parse({ name: "Acme", contactEmail: " Hello@Acme.com " }).contactEmail).toBe(
      "hello@acme.com",
    );
  });

  it("treats a blank contact email as not provided", () => {
    expect(organizationSchema.parse({ name: "Acme", contactEmail: "" }).contactEmail).toBeUndefined();
  });

  it("rejects short names, bad emails and unexpected fields", () => {
    expect(organizationSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(organizationSchema.safeParse({ name: "x".repeat(121) }).success).toBe(false);
    expect(organizationSchema.safeParse({ name: "Acme", contactEmail: "nope" }).success).toBe(false);
    expect(organizationSchema.safeParse({ name: "Acme", status: "archived" }).success).toBe(false);
  });

  it("ignores framework and unknown form entries", () => {
    const fd = new FormData();
    fd.set("name", "Acme");
    fd.set("$ACTION_ID_x", "1");
    fd.set("createdBy", "someone-else");
    expect(pickFields(fd, ORGANIZATION_FIELDS)).toEqual({ name: "Acme" });
  });
});

describe("inviting clients requires an organization", () => {
  const base = { email: "a@b.com" };

  it("requires an organization for a client and rejects a malformed id", () => {
    expect(inviteSchema.safeParse({ ...base, role: "client" }).success).toBe(false);
    expect(inviteSchema.safeParse({ ...base, role: "client", organizationId: "" }).success).toBe(false);
    expect(inviteSchema.safeParse({ ...base, role: "client", organizationId: "not-an-id" }).success).toBe(
      false,
    );
    expect(inviteSchema.safeParse({ ...base, role: "client", organizationId: ORG_ID }).success).toBe(true);
  });

  it("does not let staff roles carry an organization", () => {
    expect(inviteSchema.safeParse({ ...base, role: "support", organizationId: ORG_ID }).success).toBe(false);
    expect(inviteSchema.safeParse({ ...base, role: "support" }).success).toBe(true);
    // A blank value (a hidden select) counts as "not provided".
    expect(inviteSchema.safeParse({ ...base, role: "developer", organizationId: "" }).success).toBe(true);
  });

  it("reports the problem against the organization field", () => {
    const result = inviteSchema.safeParse({ ...base, role: "client" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "organizationId")).toBe(true);
    }
  });
});
