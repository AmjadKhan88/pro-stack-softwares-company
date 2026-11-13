import { describe, expect, it } from "vitest";
import { generateProjectCode } from "@/features/projects/code";
import {
  CONVERT_FIELDS,
  MILESTONE_FIELDS,
  convertSchema,
  deliverableSchema,
  itemStatusSchema,
  milestoneSchema,
  pickFields,
  projectStatusSchema,
  visibilitySchema,
} from "@/features/projects/schema";
import {
  PROJECT_STATUSES,
  canMoveItem,
  canMoveProject,
  clientProjectFilter,
  clientVisibleChildFilter,
  isItemStatus,
  isProjectOpen,
  itemMovesFrom,
  milestoneProgress,
  projectMovesFrom,
} from "@/features/projects/status";

const ID = "64b7f1c2a3d4e5f60718293a";
const ORG = "64b7f1c2a3d4e5f607182900";

describe("project lifecycle", () => {
  it("allows only the defined moves", () => {
    expect(canMoveProject("planning", "active")).toBe(true);
    expect(canMoveProject("active", "completed")).toBe(true);
    expect(canMoveProject("active", "on_hold")).toBe(true);
    expect(canMoveProject("on_hold", "active")).toBe(true);
    expect(canMoveProject("planning", "completed")).toBe(false);
    expect(canMoveProject("planning", "planning")).toBe(false);
    expect(canMoveProject("on_hold", "completed")).toBe(false);
  });

  it("treats completed and cancelled as closed and final", () => {
    for (const status of ["completed", "cancelled"] as const) {
      expect(isProjectOpen(status)).toBe(false);
      expect(projectMovesFrom(status)).toEqual([]);
      for (const to of PROJECT_STATUSES) expect(canMoveProject(status, to)).toBe(false);
    }
    expect(isProjectOpen("planning")).toBe(true);
    expect(isProjectOpen("active")).toBe(true);
    expect(isProjectOpen("on_hold")).toBe(true);
  });
});

describe("milestone and deliverable lifecycles", () => {
  it("moves milestones planned -> in progress -> done, and allows reopening", () => {
    expect(canMoveItem("milestone", "planned", "in_progress")).toBe(true);
    expect(canMoveItem("milestone", "in_progress", "done")).toBe(true);
    expect(canMoveItem("milestone", "done", "in_progress")).toBe(true);
    expect(canMoveItem("milestone", "planned", "done")).toBe(false);
    expect(canMoveItem("milestone", "done", "planned")).toBe(false);
  });

  it("uses 'delivered' for deliverables, never 'done'", () => {
    expect(canMoveItem("deliverable", "in_progress", "delivered")).toBe(true);
    expect(canMoveItem("deliverable", "in_progress", "done")).toBe(false);
    expect(canMoveItem("milestone", "in_progress", "delivered")).toBe(false);
    expect(isItemStatus("milestone", "done")).toBe(true);
    expect(isItemStatus("milestone", "delivered")).toBe(false);
    expect(isItemStatus("deliverable", "delivered")).toBe(true);
  });

  it("offers no moves for unknown statuses", () => {
    expect(itemMovesFrom("milestone", "nonsense")).toEqual([]);
    expect(itemMovesFrom("milestone", "constructor")).toEqual([]);
  });

  it("computes progress from the milestones given", () => {
    expect(milestoneProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    expect(milestoneProgress(["done", "planned", "in_progress", "done"])).toEqual({
      done: 2,
      total: 4,
      percent: 50,
    });
    expect(milestoneProgress(["done", "done", "planned"]).percent).toBe(67);
  });
});

describe("client tenant scoping (one client can never read another's projects)", () => {
  it("always includes the client's own organization in the project query", () => {
    const filter = clientProjectFilter(ORG, ID);
    expect(filter.organizationId).toBe(ORG);
    expect(filter._id).toBe(ID);
    expect(clientProjectFilter(ORG)).toEqual({ organizationId: ORG });
  });

  it("refuses to build a query without an organization", () => {
    expect(() => clientProjectFilter("")).toThrow();
  });

  it("only ever matches milestones and deliverables staff made visible", () => {
    expect(clientVisibleChildFilter(ID)).toEqual({ projectId: ID, clientVisible: true });
    expect(() => clientVisibleChildFilter("")).toThrow();
  });
});

describe("milestone and deliverable input", () => {
  it("accepts a milestone and treats an unticked box as hidden", () => {
    const parsed = milestoneSchema.parse({ projectId: ID, title: "Design sign-off", dueDate: "2026-12-31" });
    expect(parsed.clientVisible).toBe(false);
    expect(parsed.dueDate?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(milestoneSchema.parse({ projectId: ID, title: "Design", clientVisible: "on" }).clientVisible).toBe(
      true,
    );
  });

  it("treats blank optional fields as not provided", () => {
    const parsed = milestoneSchema.parse({ projectId: ID, title: "Design", dueDate: "", description: "  " });
    expect(parsed.dueDate).toBeUndefined();
    expect(parsed.description).toBeUndefined();
  });

  it("rejects bad dates, short titles, bad ids and unexpected fields", () => {
    expect(milestoneSchema.safeParse({ projectId: ID, title: "Design", dueDate: "31/12/2026" }).success).toBe(
      false,
    );
    expect(milestoneSchema.safeParse({ projectId: ID, title: "Design", dueDate: "2026-02-30" }).success).toBe(
      false,
    );
    expect(milestoneSchema.safeParse({ projectId: ID, title: "D" }).success).toBe(false);
    expect(milestoneSchema.safeParse({ projectId: "nope", title: "Design" }).success).toBe(false);
    expect(milestoneSchema.safeParse({ projectId: ID, title: "Design", projectStatus: "done" }).success).toBe(
      false,
    );
  });

  it("validates deliverables and their optional milestone", () => {
    expect(deliverableSchema.safeParse({ projectId: ID, title: "Wireframes", milestoneId: "" }).success).toBe(
      true,
    );
    expect(deliverableSchema.safeParse({ projectId: ID, title: "Wireframes", milestoneId: ID }).success).toBe(
      true,
    );
    expect(
      deliverableSchema.safeParse({ projectId: ID, title: "Wireframes", milestoneId: "bad" }).success,
    ).toBe(false);
  });

  it("ignores framework and forged form entries", () => {
    const fd = new FormData();
    fd.set("projectId", ID);
    fd.set("title", "Design");
    fd.set("$ACTION_ID_x", "1");
    fd.set("organizationId", ORG);
    expect(pickFields(fd, MILESTONE_FIELDS)).toEqual({ projectId: ID, title: "Design" });
  });
});

describe("status, visibility and conversion input", () => {
  it("validates project status changes", () => {
    expect(projectStatusSchema.safeParse({ projectId: ID, to: "active" }).success).toBe(true);
    expect(projectStatusSchema.safeParse({ projectId: ID, to: "deleted" }).success).toBe(false);
  });

  it("only accepts a status that belongs to the item kind", () => {
    expect(itemStatusSchema.safeParse({ kind: "milestone", id: ID, to: "done" }).success).toBe(true);
    expect(itemStatusSchema.safeParse({ kind: "milestone", id: ID, to: "delivered" }).success).toBe(false);
    expect(itemStatusSchema.safeParse({ kind: "deliverable", id: ID, to: "delivered" }).success).toBe(true);
    expect(itemStatusSchema.safeParse({ kind: "deliverable", id: ID, to: "done" }).success).toBe(false);
    expect(itemStatusSchema.safeParse({ kind: "project", id: ID, to: "done" }).success).toBe(false);
  });

  it("turns the visibility value into a boolean and rejects anything else", () => {
    expect(visibilitySchema.parse({ kind: "milestone", id: ID, visible: "true" }).visible).toBe(true);
    expect(visibilitySchema.parse({ kind: "deliverable", id: ID, visible: "false" }).visible).toBe(false);
    expect(visibilitySchema.safeParse({ kind: "milestone", id: ID, visible: "yes" }).success).toBe(false);
  });

  it("validates the conversion request", () => {
    expect(convertSchema.safeParse({ proposalId: ID }).success).toBe(true);
    expect(convertSchema.safeParse({ proposalId: "x" }).success).toBe(false);
    expect(convertSchema.safeParse({ proposalId: ID, organizationId: ORG }).success).toBe(false);
    const fd = new FormData();
    fd.set("proposalId", ID);
    fd.set("organizationId", ORG);
    expect(pickFields(fd, CONVERT_FIELDS)).toEqual({ proposalId: ID });
  });
});

describe("project codes", () => {
  it("are readable, prefixed and unique", () => {
    const codes = new Set(Array.from({ length: 300 }, generateProjectCode));
    expect(codes.size).toBe(300);
    for (const code of codes) expect(code).toMatch(/^PRJ-[A-HJKMNP-Z2-9]{8}$/);
  });
});
