import { describe, expect, it } from "vitest";
import {
  ROLE_CHANGE_OPTIONS,
  allowedRoleOptions,
  checkDisable,
  checkRoleChange,
  endsProjectAssignments,
  explainRoleChange,
} from "@/features/users/rules";
import {
  accountStatusSchema,
  accountsHref,
  changeRoleSchema,
  parseAccountFilters,
  pickFields,
  CHANGE_ROLE_FIELDS,
} from "@/features/users/schema";
import { escapeRegex, parsePageParam } from "@/lib/search";

const ID = "64b7f1c2a3d4e5f60718293a";
const OTHER = "64b7f1c2a3d4e5f607182900";

// owner A acting on someone else, one active owner unless stated.
const base = { actorId: ID, actorRole: "owner", targetId: OTHER, targetRole: "developer", ownerCount: 1 };

describe("who may change a role", () => {
  it("lets the owner move staff between staff roles, including to admin", () => {
    for (const newRole of ["admin", "project_manager", "content_manager", "support"]) {
      expect(checkRoleChange({ ...base, newRole }), newRole).toEqual({ ok: true });
    }
  });

  it("denies everyone without user management", () => {
    for (const actorRole of [
      "project_manager",
      "developer",
      "content_manager",
      "support",
      "client",
      undefined,
    ]) {
      expect(checkRoleChange({ ...base, actorRole, newRole: "support" })).toEqual({
        ok: false,
        reason: "no-permission",
      });
    }
  });

  it("never lets anyone change their own role", () => {
    for (const actorRole of ["owner", "admin"]) {
      expect(checkRoleChange({ ...base, actorRole, targetId: ID, newRole: "support" })).toEqual({
        ok: false,
        reason: "self",
      });
    }
  });

  it("never grants ownership here", () => {
    expect(checkRoleChange({ ...base, newRole: "owner" })).toEqual({
      ok: false,
      reason: "owner-not-grantable",
    });
  });

  it("rejects unknown roles and no-op changes", () => {
    expect(checkRoleChange({ ...base, newRole: "superuser" })).toEqual({ ok: false, reason: "invalid-role" });
    expect(checkRoleChange({ ...base, newRole: undefined })).toEqual({ ok: false, reason: "invalid-role" });
    expect(checkRoleChange({ ...base, newRole: "developer" })).toEqual({ ok: false, reason: "same-role" });
  });

  it("locks client accounts in both directions", () => {
    expect(checkRoleChange({ ...base, targetRole: "client", newRole: "support" })).toEqual({
      ok: false,
      reason: "client-role-locked",
    });
    expect(checkRoleChange({ ...base, newRole: "client" })).toEqual({
      ok: false,
      reason: "client-role-locked",
    });
  });

  it("stops admins touching the owner or other admins, or granting admin", () => {
    const asAdmin = { ...base, actorRole: "admin" };
    expect(checkRoleChange({ ...asAdmin, targetRole: "owner", newRole: "support" })).toEqual({
      ok: false,
      reason: "owner-protected",
    });
    expect(checkRoleChange({ ...asAdmin, targetRole: "admin", newRole: "support" })).toEqual({
      ok: false,
      reason: "admin-protected",
    });
    expect(checkRoleChange({ ...asAdmin, newRole: "admin" })).toEqual({
      ok: false,
      reason: "role-not-allowed",
    });
  });

  it("lets admins manage non-admin staff", () => {
    const asAdmin = { ...base, actorRole: "admin" };
    for (const newRole of ["project_manager", "content_manager", "support"]) {
      expect(checkRoleChange({ ...asAdmin, newRole }), newRole).toEqual({ ok: true });
    }
  });

  it("protects the last owner, and lets an owner change another only when more than one exists", () => {
    expect(checkRoleChange({ ...base, targetRole: "owner", ownerCount: 1, newRole: "admin" })).toEqual({
      ok: false,
      reason: "last-owner",
    });
    expect(checkRoleChange({ ...base, targetRole: "owner", ownerCount: 2, newRole: "admin" })).toEqual({
      ok: true,
    });
  });
});

describe("who may disable or re-enable an account", () => {
  it("lets the owner and admins disable clients and ordinary staff", () => {
    for (const actorRole of ["owner", "admin"]) {
      for (const targetRole of ["client", "developer", "support", "project_manager", "content_manager"]) {
        expect(checkDisable({ ...base, actorRole, targetRole }), `${actorRole}->${targetRole}`).toEqual({
          ok: true,
        });
      }
    }
  });

  it("never lets anyone disable themselves", () => {
    expect(checkDisable({ ...base, targetId: ID })).toEqual({ ok: false, reason: "self" });
    expect(checkDisable({ ...base, actorRole: "admin", targetId: ID })).toEqual({
      ok: false,
      reason: "self",
    });
  });

  it("protects owners and admins from admins, and the last owner from everyone", () => {
    expect(checkDisable({ ...base, actorRole: "admin", targetRole: "owner" })).toEqual({
      ok: false,
      reason: "owner-protected",
    });
    expect(checkDisable({ ...base, actorRole: "admin", targetRole: "admin" })).toEqual({
      ok: false,
      reason: "admin-protected",
    });
    expect(checkDisable({ ...base, targetRole: "owner", ownerCount: 1 })).toEqual({
      ok: false,
      reason: "last-owner",
    });
    expect(checkDisable({ ...base, targetRole: "owner", ownerCount: 2 })).toEqual({ ok: true });
  });

  it("denies users without user management", () => {
    expect(checkDisable({ ...base, actorRole: "support" })).toEqual({ ok: false, reason: "no-permission" });
  });
});

describe("what the screen offers", () => {
  it("offers the owner every staff role except the current one and never owner or client", () => {
    const options = allowedRoleOptions({ ...base, targetRole: "support" });
    expect(options).toEqual(ROLE_CHANGE_OPTIONS.filter((role) => role !== "support"));
    expect(options).not.toContain("owner" as never);
    expect(options).not.toContain("client" as never);
  });

  it("offers admins everything except admin", () => {
    expect(allowedRoleOptions({ ...base, actorRole: "admin" })).toEqual(
      ROLE_CHANGE_OPTIONS.filter((role) => role !== "admin" && role !== "developer"),
    );
  });

  it("offers nothing and explains why when the account is protected", () => {
    expect(allowedRoleOptions({ ...base, targetId: ID })).toEqual([]);
    expect(explainRoleChange({ ...base, targetId: ID })).toMatch(/your own role/i);
    expect(explainRoleChange({ ...base, targetRole: "client" })).toMatch(/client accounts/i);
    expect(explainRoleChange({ ...base, targetRole: "owner", ownerCount: 1 })).toMatch(/only owner/i);
    expect(explainRoleChange({ ...base, actorRole: "admin", targetRole: "admin" })).toMatch(
      /only the owner/i,
    );
    expect(explainRoleChange(base)).toBeNull();
  });

  it("ends project assignments only when the new role can't be on a team", () => {
    for (const role of ["project_manager", "developer", "support"])
      expect(endsProjectAssignments(role)).toBe(false);
    for (const role of ["admin", "content_manager", "client", "owner"])
      expect(endsProjectAssignments(role)).toBe(true);
  });
});

describe("input and filters", () => {
  it("validates role changes and status changes", () => {
    expect(changeRoleSchema.safeParse({ userId: ID, role: "support" }).success).toBe(true);
    expect(changeRoleSchema.safeParse({ userId: ID, role: "owner" }).success).toBe(false);
    expect(changeRoleSchema.safeParse({ userId: ID, role: "client" }).success).toBe(false);
    expect(changeRoleSchema.safeParse({ userId: "nope", role: "support" }).success).toBe(false);
    expect(changeRoleSchema.safeParse({ userId: ID, role: "support", isAdmin: true }).success).toBe(false);
    expect(
      accountStatusSchema.safeParse({ userId: ID, action: "disable", reason: "  left the company " }).success,
    ).toBe(true);
    expect(accountStatusSchema.parse({ userId: ID, action: "enable", reason: "" }).reason).toBeUndefined();
    expect(accountStatusSchema.safeParse({ userId: ID, action: "delete" }).success).toBe(false);
    expect(
      accountStatusSchema.safeParse({ userId: ID, action: "disable", reason: "x".repeat(201) }).success,
    ).toBe(false);
  });

  it("ignores framework and forged form entries", () => {
    const fd = new FormData();
    fd.set("userId", ID);
    fd.set("role", "support");
    fd.set("$ACTION_ID_x", "1");
    fd.set("actorRole", "owner");
    expect(pickFields(fd, CHANGE_ROLE_FIELDS)).toEqual({ userId: ID, role: "support" });
  });

  it("reads filters defensively", () => {
    expect(parseAccountFilters({ q: "  Ayesha ", role: "support", status: "disabled", page: "3" })).toEqual({
      q: "Ayesha",
      role: "support",
      status: "disabled",
      page: 3,
    });
    expect(parseAccountFilters({ role: "root", status: "gone", page: "-4", q: "   " })).toEqual({
      q: undefined,
      role: undefined,
      status: undefined,
      page: 1,
    });
    expect(parseAccountFilters({ q: "x".repeat(300) }).q).toHaveLength(100);
    expect(parsePageParam(["2", "9"])).toBe(2);
  });

  it("builds links that keep the filters", () => {
    const filters = { q: "a b", role: "support" as const, status: "active" as const, page: 2 };
    expect(accountsHref(filters)).toBe("/admin/users?q=a+b&role=support&status=active&page=2");
    expect(accountsHref(filters, { page: 1 })).toBe("/admin/users?q=a+b&role=support&status=active");
    expect(accountsHref({ page: 1 })).toBe("/admin/users");
  });

  it("escapes search text before it reaches a regular expression", () => {
    const hostile = ".*(a+)+$[x]\\";
    const pattern = new RegExp(escapeRegex(hostile), "i");
    expect(pattern.test(hostile)).toBe(true);
    expect(pattern.test("anything else")).toBe(false);
  });
});
