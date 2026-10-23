import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLES,
  STAFF_ROLES,
  can,
  canAssignRole,
  isStaffRole,
  requiresTwoFactor,
} from "@/server/policies/permissions";

describe("permissions (default deny)", () => {
  it("denies unknown, missing and multi-valued roles everything", () => {
    for (const role of [undefined, null, "", "root", "admin,owner", 42]) {
      for (const permission of PERMISSIONS) expect(can(role, permission)).toBe(false);
    }
  });

  it("keeps clients out of every staff permission", () => {
    expect(can("client", "portal.access")).toBe(true);
    for (const permission of PERMISSIONS.filter((p) => p !== "portal.access")) {
      expect(can("client", permission)).toBe(false);
    }
  });

  it("keeps staff out of the client portal permission", () => {
    for (const role of STAFF_ROLES) expect(can(role, "portal.access")).toBe(false);
  });

  it("gives every staff role admin access and nobody else", () => {
    for (const role of ROLES) expect(can(role, "admin.access")).toBe(isStaffRole(role));
  });

  it("matches the roles matrix for sensitive actions", () => {
    expect(can("content_manager", "content.publish")).toBe(true);
    expect(can("content_manager", "leads.read")).toBe(false);
    expect(can("support", "leads.read")).toBe(true);
    expect(can("support", "content.publish")).toBe(false);
    expect(can("developer", "projects.read.assigned")).toBe(true);
    expect(can("developer", "projects.read.all")).toBe(false);
    expect(can("project_manager", "users.manage")).toBe(false);
    expect(can("admin", "users.manage")).toBe(true);
    expect(can("admin", "audit.read")).toBe(true);
  });
});

describe("two-factor and role assignment", () => {
  it("requires two-factor for owner and admin only", () => {
    expect(requiresTwoFactor("owner")).toBe(true);
    expect(requiresTwoFactor("admin")).toBe(true);
    for (const role of ["project_manager", "developer", "content_manager", "support", "client"]) {
      expect(requiresTwoFactor(role)).toBe(false);
    }
  });

  it("lets only the owner create admins and owners", () => {
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("owner", "owner")).toBe(true);
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "support")).toBe(true);
    expect(canAssignRole("admin", "client")).toBe(true);
  });

  it("denies role changes by anyone else and to unknown roles", () => {
    for (const actor of ["project_manager", "developer", "content_manager", "support", "client", undefined]) {
      expect(canAssignRole(actor, "client")).toBe(false);
    }
    expect(canAssignRole("owner", "superuser")).toBe(false);
  });
});
