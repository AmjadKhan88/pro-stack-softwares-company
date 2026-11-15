import { describe, expect, it } from "vitest";
import { adminNav, filterNavForRole } from "@/config/navigation";
import {
  ASSIGNABLE_ROLES,
  canReadProject,
  isAssignableRole,
  projectAccessScope,
} from "@/features/projects/access-rules";
import { TEAM_FIELDS, pickFields, teamMemberSchema } from "@/features/projects/team-schema";
import { ROLES } from "@/server/policies/permissions";

const ID = "64b7f1c2a3d4e5f60718293a";
const OTHER = "64b7f1c2a3d4e5f607182900";

describe("who may read projects", () => {
  it("gives support, project managers, admins and the owner every project", () => {
    for (const role of ["support", "project_manager", "admin", "owner"])
      expect(projectAccessScope(role)).toBe("all");
  });

  it("gives developers only the projects they are assigned to", () => {
    expect(projectAccessScope("developer")).toBe("assigned");
  });

  it("gives everyone else (clients, content managers, unknown roles) nothing", () => {
    for (const role of ["client", "content_manager", undefined, null, "", "root", "admin,owner"]) {
      expect(projectAccessScope(role)).toBe("none");
    }
  });

  it("lets a developer read a project only when assigned", () => {
    expect(canReadProject({ role: "developer", isMember: true })).toBe(true);
    expect(canReadProject({ role: "developer", isMember: false })).toBe(false);
  });

  it("does not need assignment for roles that see everything", () => {
    for (const role of ["support", "project_manager", "admin", "owner"]) {
      expect(canReadProject({ role, isMember: false })).toBe(true);
    }
  });

  it("never lets a role without project access in, even if it is somehow a member", () => {
    for (const role of ["client", "content_manager", undefined, "root"]) {
      expect(canReadProject({ role, isMember: true })).toBe(false);
    }
  });

  it("covers every role exactly once", () => {
    const scopes = ROLES.map((role) => projectAccessScope(role));
    expect(scopes.filter((s) => s === "assigned")).toHaveLength(1);
    expect(scopes.filter((s) => s === "all")).toHaveLength(4);
    expect(scopes.filter((s) => s === "none")).toHaveLength(2);
  });
});

describe("who can be put on a project team", () => {
  it("is limited to delivery roles", () => {
    expect([...ASSIGNABLE_ROLES].sort()).toEqual(["developer", "project_manager", "support"]);
    for (const role of ["owner", "admin", "client", "content_manager", undefined, "root"]) {
      expect(isAssignableRole(role)).toBe(false);
    }
  });
});

describe("team input", () => {
  it("needs a valid project and person", () => {
    expect(teamMemberSchema.safeParse({ projectId: ID, userId: OTHER }).success).toBe(true);
    expect(teamMemberSchema.safeParse({ projectId: "nope", userId: OTHER }).success).toBe(false);
    expect(teamMemberSchema.safeParse({ projectId: ID, userId: "" }).success).toBe(false);
    expect(teamMemberSchema.safeParse({ projectId: ID, userId: { $ne: null } }).success).toBe(false);
  });

  it("rejects unexpected fields and ignores forged form entries", () => {
    expect(teamMemberSchema.safeParse({ projectId: ID, userId: OTHER, role: "owner" }).success).toBe(false);
    const fd = new FormData();
    fd.set("projectId", ID);
    fd.set("userId", OTHER);
    fd.set("role", "owner");
    fd.set("$ACTION_ID_x", "1");
    expect(pickFields(fd, TEAM_FIELDS)).toEqual({ projectId: ID, userId: OTHER });
  });
});

describe("the admin menu follows permissions", () => {
  const labels = (role: string) =>
    filterNavForRole(adminNav, role)
      .flatMap((group) => group.items)
      .map((item) => item.label);

  it("shows a developer only the overview and projects", () => {
    expect(labels("developer")).toEqual(["Overview", "Projects"]);
  });

  it("shows support the leads inbox but not clients, proposals or user management", () => {
    const support = labels("support");
    expect(support).toContain("Leads");
    expect(support).toContain("Projects");
    for (const hidden of ["Clients", "Proposals", "Users & roles", "Audit log"])
      expect(support).not.toContain(hidden);
  });

  it("shows a project manager the client work but not platform administration", () => {
    const pm = labels("project_manager");
    for (const shown of ["Projects", "Leads", "Clients", "Proposals"]) expect(pm).toContain(shown);
    for (const hidden of ["Users & roles", "Audit log"]) expect(pm).not.toContain(hidden);
  });

  it("shows admins and the owner everything", () => {
    const everything = adminNav.flatMap((group) => group.items).map((item) => item.label);
    expect(labels("owner")).toEqual(everything);
    expect(labels("admin")).toEqual(everything);
  });

  it("drops groups that end up empty and shows an unknown role only the overview", () => {
    expect(filterNavForRole(adminNav, "developer").map((group) => group.label)).toEqual(["Workspace"]);
    expect(labels("root")).toEqual(["Overview"]);
  });
});
