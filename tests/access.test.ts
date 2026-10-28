import { describe, expect, it } from "vitest";
import { homeFor, isTwoFactorBlocked, resolveAccess } from "@/server/policies/access";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { describeCodeError, describeSignInError } from "@/features/auth/messages";

const user = (role: unknown, twoFactorEnabled = false) => ({ role, twoFactorEnabled });
const allow = { type: "allow" };
const to = (path: string) => ({ type: "redirect", to: path });

describe("resolveAccess", () => {
  it("sends signed-out visitors to the login page for every protected area", () => {
    for (const area of ["admin", "portal", "account"] as const) {
      expect(resolveAccess(null, area)).toEqual(to("/login"));
    }
  });

  it("keeps clients out of admin and staff out of the portal", () => {
    expect(resolveAccess(user("client"), "admin")).toEqual(to("/portal"));
    expect(resolveAccess(user("support"), "portal")).toEqual(to("/admin"));
    expect(resolveAccess(user("owner", true), "portal")).toEqual(to("/admin"));
  });

  it("lets each role into its own area", () => {
    expect(resolveAccess(user("client"), "portal")).toEqual(allow);
    for (const role of ["project_manager", "developer", "content_manager", "support"]) {
      expect(resolveAccess(user(role), "admin")).toEqual(allow);
    }
  });

  it("forces owner and admin to set up two-factor before the admin area", () => {
    expect(resolveAccess(user("owner", false), "admin")).toEqual(to("/security/two-factor"));
    expect(resolveAccess(user("admin", false), "admin")).toEqual(to("/security/two-factor"));
    expect(resolveAccess(user("owner", true), "admin")).toEqual(allow);
    expect(resolveAccess(user("admin", true), "admin")).toEqual(allow);
  });

  it("still lets an owner without two-factor reach the setup page itself", () => {
    expect(resolveAccess(user("owner", false), "account")).toEqual(allow);
  });

  it("gives unknown or missing roles no access (and no redirect loop)", () => {
    for (const role of [null, undefined, "", "root", "admin,owner"]) {
      expect(resolveAccess(user(role), "admin")).toEqual(to("/no-access"));
      expect(resolveAccess(user(role), "portal")).toEqual(to("/no-access"));
      expect(homeFor(role)).toBe("/no-access");
    }
  });

  it("routes by role after login", () => {
    expect(homeFor("owner")).toBe("/admin");
    expect(homeFor("client")).toBe("/portal");
  });
});

describe("isTwoFactorBlocked (admin API guard)", () => {
  it("blocks admin endpoints for owner/admin without two-factor only", () => {
    expect(isTwoFactorBlocked(user("owner", false), "/admin/create-user")).toBe(true);
    expect(isTwoFactorBlocked(user("admin", false), "/admin/ban-user")).toBe(true);
    expect(isTwoFactorBlocked(user("owner", true), "/admin/create-user")).toBe(false);
    expect(isTwoFactorBlocked(user("support", false), "/admin/list-users")).toBe(false);
  });

  it("does not block other endpoints (so setup can complete) or server-side calls", () => {
    expect(isTwoFactorBlocked(user("owner", false), "/two-factor/enable")).toBe(false);
    expect(isTwoFactorBlocked(null, "/admin/create-user")).toBe(false);
  });
});

describe("safeRedirectPath (open-redirect protection)", () => {
  it("accepts same-site paths", () => {
    expect(safeRedirectPath("/admin")).toBe("/admin");
    expect(safeRedirectPath("/portal/projects?x=1")).toBe("/portal/projects?x=1");
  });

  it("rejects anything that could leave the site or is malformed", () => {
    const bad = [
      "//evil.com",
      "https://evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      "admin",
      "",
      "/a\nb",
      "/" + "x".repeat(300),
      null,
      undefined,
      42,
    ];
    for (const value of bad) expect(safeRedirectPath(value)).toBeNull();
  });
});

describe("auth messages", () => {
  it("never reveals whether an account exists", () => {
    const wrong = describeSignInError({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" });
    expect(wrong).toEqual({ kind: "error", message: "Incorrect email or password." });
    expect(describeSignInError({ code: "SOMETHING_ELSE" }).kind).toBe("error");
  });

  it("recognises unverified, disabled and rate-limited cases", () => {
    expect(describeSignInError({ code: "EMAIL_NOT_VERIFIED" })).toEqual({ kind: "email-not-verified" });
    expect(describeSignInError({ code: "BANNED_USER" })).toMatchObject({ kind: "error" });
    expect(describeSignInError({ status: 429 })).toMatchObject({
      message: expect.stringMatching(/too many/i),
    });
    expect(describeCodeError({ code: "INVALID_CODE" })).toMatch(/didn't work/);
  });
});
