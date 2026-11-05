import { describe, expect, it } from "vitest";
import {
  LEAD_STATUSES,
  LEAD_TRANSITIONS,
  availableTransitions,
  isLeadStatus,
  normalizeLeadStatus,
  validateTransition,
  type LeadStatus,
} from "@/features/leads/pipeline";
import {
  LEAD_ID_FIELDS,
  NOTE_FIELDS,
  PAGE_SIZE,
  STATUS_CHANGE_FIELDS,
  escapeRegex,
  leadIdSchema,
  leadsHref,
  noteSchema,
  parseLeadFilters,
  pickFields,
  statusChangeSchema,
} from "@/features/leads/admin-schema";

const ID = "64b7f1c2a3d4e5f60718293a";

describe("lead pipeline transitions", () => {
  it("allows exactly the moves in the pipeline and nothing else", () => {
    const allowed = (from: LeadStatus, to: LeadStatus) =>
      validateTransition({ from, to, hasOrganization: true }).ok;
    for (const from of LEAD_STATUSES) {
      for (const to of LEAD_STATUSES) {
        expect(allowed(from, to), `${from} -> ${to}`).toBe(LEAD_TRANSITIONS[from].includes(to));
      }
    }
  });

  it("never lets a lead stay in the same status or skip steps", () => {
    for (const status of LEAD_STATUSES) {
      expect(validateTransition({ from: status, to: status, hasOrganization: true })).toEqual({
        ok: false,
        reason: "invalid-transition",
      });
    }
    expect(validateTransition({ from: "new", to: "qualified", hasOrganization: true }).ok).toBe(false);
    expect(validateTransition({ from: "new", to: "won", hasOrganization: true }).ok).toBe(false);
    expect(validateTransition({ from: "contacted", to: "won", hasOrganization: true }).ok).toBe(false);
  });

  it("treats won as final and lets a lost lead be reopened", () => {
    expect(LEAD_TRANSITIONS.won).toEqual([]);
    expect(validateTransition({ from: "lost", to: "contacted", hasOrganization: false }).ok).toBe(true);
    expect(validateTransition({ from: "lost", to: "won", hasOrganization: true }).ok).toBe(false);
  });

  it("requires a client organization before a lead can be won", () => {
    expect(validateTransition({ from: "qualified", to: "won", hasOrganization: false })).toEqual({
      ok: false,
      reason: "needs-organization",
    });
    expect(validateTransition({ from: "qualified", to: "won", hasOrganization: true })).toEqual({ ok: true });
  });

  it("only offers moves that would actually be accepted", () => {
    expect(availableTransitions("qualified", false)).toEqual(["lost"]);
    expect(availableTransitions("qualified", true)).toEqual(["won", "lost"]);
    expect(availableTransitions("new", false)).toEqual(["contacted", "lost"]);
    expect(availableTransitions("won", true)).toEqual([]);
  });

  it("recognises statuses and cleans up legacy values", () => {
    expect(isLeadStatus("qualified")).toBe(true);
    expect(isLeadStatus("closed")).toBe(false);
    expect(isLeadStatus(undefined)).toBe(false);
    expect(normalizeLeadStatus("closed")).toBe("lost");
    expect(normalizeLeadStatus("weird")).toBe("new");
    expect(normalizeLeadStatus("won")).toBe("won");
  });
});

describe("lead list filters", () => {
  it("reads valid values", () => {
    expect(parseLeadFilters({ status: "new", q: "  Acme ", page: "3" })).toEqual({
      status: "new",
      q: "Acme",
      page: 3,
    });
  });

  it("ignores invalid values instead of trusting them", () => {
    expect(parseLeadFilters({ status: "hacked", q: "   ", page: "-5" })).toEqual({
      status: undefined,
      q: undefined,
      page: 1,
    });
    expect(parseLeadFilters({ page: "abc" }).page).toBe(1);
    expect(parseLeadFilters({ page: "99999999" }).page).toBe(10_000);
    expect(parseLeadFilters({ status: ["won", "new"] }).status).toBe("won");
  });

  it("caps the search text length", () => {
    expect(parseLeadFilters({ q: "x".repeat(500) }).q).toHaveLength(100);
  });

  it("builds links that keep the filters", () => {
    const filters = { status: "new" as const, q: "a b", page: 2 };
    expect(leadsHref(filters)).toBe("/admin/leads?status=new&q=a+b&page=2");
    expect(leadsHref(filters, { page: 1 })).toBe("/admin/leads?status=new&q=a+b");
    expect(leadsHref({ page: 1 })).toBe("/admin/leads");
  });

  it("uses a sensible page size", () => {
    expect(PAGE_SIZE).toBe(20);
  });
});

describe("search text is escaped before it reaches a regular expression", () => {
  it("neutralises pattern characters", () => {
    const hostile = ".*(a+)+$[x]\\";
    const pattern = new RegExp(escapeRegex(hostile), "i");
    expect(pattern.test(hostile)).toBe(true);
    expect(pattern.test("anything else")).toBe(false);
    expect(escapeRegex("a.b")).toBe("a\\.b");
  });
});

describe("action input validation", () => {
  it("accepts a valid status change and treats a blank note as absent", () => {
    expect(statusChangeSchema.parse({ leadId: ID, to: "contacted", note: "" })).toEqual({
      leadId: ID,
      to: "contacted",
      note: undefined,
    });
    expect(statusChangeSchema.parse({ leadId: ID, to: "lost", note: "  Budget too low " }).note).toBe(
      "Budget too low",
    );
  });

  it("rejects bad ids, unknown statuses, long notes and unexpected fields", () => {
    expect(statusChangeSchema.safeParse({ leadId: "not-an-id", to: "new" }).success).toBe(false);
    expect(statusChangeSchema.safeParse({ leadId: ID, to: "archived" }).success).toBe(false);
    expect(statusChangeSchema.safeParse({ leadId: ID, to: "lost", note: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(statusChangeSchema.safeParse({ leadId: ID, to: "lost", status: "won" }).success).toBe(false);
    expect(leadIdSchema.safeParse({ leadId: { $ne: null } }).success).toBe(false);
  });

  it("validates notes", () => {
    expect(noteSchema.safeParse({ leadId: ID, body: "Called, will reply Monday." }).success).toBe(true);
    expect(noteSchema.safeParse({ leadId: ID, body: "   " }).success).toBe(false);
    expect(noteSchema.safeParse({ leadId: ID, body: "x".repeat(2001) }).success).toBe(false);
  });

  it("ignores framework and unknown form entries", () => {
    const fd = new FormData();
    fd.set("leadId", ID);
    fd.set("to", "contacted");
    fd.set("$ACTION_ID_x", "1");
    fd.set("organizationId", "someone-elses");
    expect(pickFields(fd, STATUS_CHANGE_FIELDS)).toEqual({ leadId: ID, to: "contacted" });
    expect(pickFields(fd, NOTE_FIELDS)).toEqual({ leadId: ID });
    expect(pickFields(fd, LEAD_ID_FIELDS)).toEqual({ leadId: ID });
  });
});
