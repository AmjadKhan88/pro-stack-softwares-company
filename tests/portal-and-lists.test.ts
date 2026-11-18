import { describe, expect, it } from "vitest";
import { AUDIT_LABELS } from "@/features/audit/labels";
import { AUDIT_ACTIONS } from "@/features/audit/types";
import { dashboardSections, hasAnySection } from "@/features/dashboard/sections";
import { CLIENT_REQUEST_STATUS, clientRequestStatus } from "@/features/leads/client-view";
import { REQUEST_FIELDS, pickFields, portalRequestSchema } from "@/features/leads/request-schema";
import {
  parseAuditFilters,
  parseOrganizationFilters,
  parseProjectFilters,
  parseProposalFilters,
} from "@/features/lists/params";
import { listHref, paginate } from "@/lib/list-links";

const GOOD = {
  projectType: "web-app",
  budgetRange: "5k-15k",
  timeframe: "1-3-months",
  message: "We need a dashboard for our dispatchers to track late deliveries.",
};

describe("portal project request", () => {
  it("accepts a valid request and treats blank optional fields as not given", () => {
    expect(portalRequestSchema.safeParse(GOOD).success).toBe(true);
    const parsed = portalRequestSchema.parse({ ...GOOD, budgetRange: "", timeframe: "  " });
    expect(parsed.budgetRange).toBeUndefined();
    expect(parsed.timeframe).toBeUndefined();
  });

  it("needs a real description and a known project type", () => {
    expect(portalRequestSchema.safeParse({ ...GOOD, message: "too short" }).success).toBe(false);
    expect(portalRequestSchema.safeParse({ ...GOOD, message: "x".repeat(4001) }).success).toBe(false);
    expect(portalRequestSchema.safeParse({ ...GOOD, projectType: "hacking" }).success).toBe(false);
    expect(portalRequestSchema.safeParse({ ...GOOD, budgetRange: "a lot" }).success).toBe(false);
  });

  it("never takes who is asking from the form", () => {
    for (const extra of [
      { organizationId: "abc" },
      { email: "x@y.com" },
      { name: "Someone" },
      { status: "won" },
    ]) {
      expect(portalRequestSchema.safeParse({ ...GOOD, ...extra }).success).toBe(false);
    }
    const fd = new FormData();
    for (const [key, value] of Object.entries(GOOD)) fd.set(key, value);
    fd.set("organizationId", "someone-elses");
    fd.set("email", "forged@example.com");
    fd.set("$ACTION_ID_x", "1");
    expect(Object.keys(pickFields(fd, REQUEST_FIELDS)).sort()).toEqual(Object.keys(GOOD).sort());
  });
});

describe("what a client sees about their request", () => {
  it("uses plain wording and never the internal pipeline stages", () => {
    for (const entry of Object.values(CLIENT_REQUEST_STATUS)) {
      expect(`${entry.label} ${entry.note}`).not.toMatch(/\b(qualified|contacted|pipeline|lead|won|lost)\b/i);
    }
  });

  it("maps every internal status, including the legacy 'closed'", () => {
    expect(clientRequestStatus("new").label).toBe("Received");
    expect(clientRequestStatus("contacted").label).toBe("In review");
    expect(clientRequestStatus("qualified").label).toBe("In review");
    expect(clientRequestStatus("won").label).toBe("Accepted");
    expect(clientRequestStatus("lost").label).toBe("Closed");
    expect(clientRequestStatus("closed").label).toBe("Closed");
  });
});

describe("what each role's dashboard may show", () => {
  const sections = (role: string) => dashboardSections(role);

  it("gives the owner and admins everything", () => {
    for (const role of ["owner", "admin"]) {
      expect(sections(role)).toEqual({
        leads: true,
        proposals: true,
        projects: true,
        clients: true,
        activity: true,
      });
    }
  });

  it("gives project managers the client work but not the audit trail", () => {
    expect(sections("project_manager")).toEqual({
      leads: true,
      proposals: true,
      projects: true,
      clients: true,
      activity: false,
    });
  });

  it("gives support leads and projects only", () => {
    expect(sections("support")).toEqual({
      leads: true,
      proposals: false,
      projects: true,
      clients: false,
      activity: false,
    });
  });

  it("gives developers project numbers only (limited to their assigned projects by the server)", () => {
    expect(sections("developer")).toEqual({
      leads: false,
      proposals: false,
      projects: true,
      clients: false,
      activity: false,
    });
  });

  it("shows nothing to roles with no admin data, or an unknown role", () => {
    for (const role of ["content_manager", "client", "root", "", undefined, null]) {
      expect(hasAnySection(dashboardSections(role))).toBe(false);
    }
  });
});

describe("audit labels", () => {
  it("cover every audit action exactly, so a new action can't be shown as raw text", () => {
    expect(Object.keys(AUDIT_LABELS).sort()).toEqual([...AUDIT_ACTIONS].sort());
  });
});

describe("list links and pages", () => {
  it("builds links from only the values that are set", () => {
    expect(listHref("/admin/projects", { q: "a b", status: "active", page: 1 })).toBe(
      "/admin/projects?q=a+b&status=active",
    );
    expect(listHref("/admin/projects", { q: "", status: undefined, page: 3 })).toBe("/admin/projects?page=3");
    expect(listHref("/admin/projects", {})).toBe("/admin/projects");
  });

  it("clamps pages to what exists", () => {
    expect(paginate(0, 1)).toEqual({ page: 1, pageCount: 1, skip: 0, limit: 20 });
    expect(paginate(45, 3)).toEqual({ page: 3, pageCount: 3, skip: 40, limit: 20 });
    expect(paginate(45, 99).page).toBe(3);
    expect(paginate(45, -5).page).toBe(1);
    expect(paginate(45, Number.NaN).page).toBe(1);
    expect(paginate(60, 2, 25)).toEqual({ page: 2, pageCount: 3, skip: 25, limit: 25 });
  });
});

describe("reading list filters from the address bar", () => {
  it("keeps valid values and ignores everything else", () => {
    expect(parseProjectFilters({ q: "  Booking ", status: "active", page: "2" })).toEqual({
      q: "Booking",
      status: "active",
      page: 2,
    });
    expect(parseProjectFilters({ status: "deleted", page: "-1", q: "   " })).toEqual({
      q: undefined,
      status: undefined,
      page: 1,
    });
    expect(parseProposalFilters({ status: "sent" }).status).toBe("sent");
    expect(parseProposalFilters({ status: "expired" }).status).toBeUndefined(); // "expired" is display-only
    expect(parseOrganizationFilters({ status: "archived" }).status).toBe("archived");
    expect(parseOrganizationFilters({ status: "weird" }).status).toBeUndefined();
    expect(parseAuditFilters({ action: "proposal.sent" }).action).toBe("proposal.sent");
    expect(parseAuditFilters({ action: "drop.database" }).action).toBeUndefined();
  });

  it("takes only the first value of a repeated parameter and caps search length", () => {
    expect(parseProjectFilters({ status: ["active", "completed"] }).status).toBe("active");
    expect(parseProjectFilters({ status: ["$ne", "active"] }).status).toBeUndefined();
    expect(parseProjectFilters({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});
