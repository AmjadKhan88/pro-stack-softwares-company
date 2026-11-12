import { describe, expect, it } from "vitest";
import { generateProposalCode } from "@/features/proposals/code";
import { formatMoney, minorToInput, parseMoneyToMinor } from "@/features/proposals/money";
import {
  PROPOSAL_FIELDS,
  RESPOND_FIELDS,
  createProposalSchema,
  pickFields,
  proposalInputSchema,
  respondSchema,
  splitLines,
  staffTransitionSchema,
} from "@/features/proposals/schema";
import {
  CLIENT_VISIBLE_STATUSES,
  PROPOSAL_STATUSES,
  PROPOSAL_VALIDITY_DAYS,
  canMove,
  canRespond,
  clientProposalFilter,
  displayStatus,
  expiryFrom,
  isEditable,
  staffMovesFrom,
  type ProposalStatus,
} from "@/features/proposals/status";

const ID = "64b7f1c2a3d4e5f60718293a";
const ORG = "64b7f1c2a3d4e5f607182900";

describe("proposal lifecycle", () => {
  it("lets staff only send, withdraw and reopen, never accept or decline", () => {
    expect(canMove("draft", "sent", "staff")).toBe(true);
    expect(canMove("sent", "withdrawn", "staff")).toBe(true);
    expect(canMove("declined", "draft", "staff")).toBe(true);
    expect(canMove("withdrawn", "draft", "staff")).toBe(true);
    for (const to of ["accepted", "declined"] as const) expect(canMove("sent", to, "staff")).toBe(false);
    expect(canMove("draft", "accepted", "staff")).toBe(false);
  });

  it("lets a client only answer a sent proposal", () => {
    expect(canMove("sent", "accepted", "client")).toBe(true);
    expect(canMove("sent", "declined", "client")).toBe(true);
    for (const from of PROPOSAL_STATUSES.filter((s) => s !== "sent")) {
      for (const to of PROPOSAL_STATUSES) expect(canMove(from, to, "client"), `${from}->${to}`).toBe(false);
    }
    expect(canMove("sent", "withdrawn", "client")).toBe(false);
    expect(canMove("draft", "sent", "client")).toBe(false);
  });

  it("treats accepted as final for everyone", () => {
    for (const to of PROPOSAL_STATUSES) {
      expect(canMove("accepted", to, "staff")).toBe(false);
      expect(canMove("accepted", to, "client")).toBe(false);
    }
    expect(staffMovesFrom("accepted")).toEqual([]);
  });

  it("allows editing only while a draft", () => {
    for (const status of PROPOSAL_STATUSES)
      expect(isEditable(status as ProposalStatus)).toBe(status === "draft");
  });

  it("expires sent proposals after the validity period", () => {
    const sentAt = new Date("2026-01-01T00:00:00Z");
    const expiresAt = expiryFrom(sentAt);
    expect(expiresAt.getTime() - sentAt.getTime()).toBe(PROPOSAL_VALIDITY_DAYS * 86_400_000);
    const before = new Date("2026-01-15T00:00:00Z");
    const after = new Date("2026-03-01T00:00:00Z");
    expect(displayStatus({ status: "sent", expiresAt }, before)).toBe("sent");
    expect(displayStatus({ status: "sent", expiresAt }, after)).toBe("expired");
    expect(displayStatus({ status: "accepted", expiresAt }, after)).toBe("accepted");
    expect(canRespond({ status: "sent", expiresAt }, before)).toBe(true);
    expect(canRespond({ status: "sent", expiresAt }, after)).toBe(false);
    expect(canRespond({ status: "draft" }, before)).toBe(false);
  });
});

describe("client tenant scoping (one client can never read another's proposals)", () => {
  it("always includes the client's own organization in the query", () => {
    const filter = clientProposalFilter(ORG, ID);
    expect(filter.organizationId).toBe(ORG);
    expect(filter._id).toBe(ID);
  });

  it("hides drafts and withdrawn proposals from clients", () => {
    const visible = clientProposalFilter(ORG).status.$in;
    expect(visible).toEqual([...CLIENT_VISIBLE_STATUSES]);
    expect(visible).not.toContain("draft");
    expect(visible).not.toContain("withdrawn");
  });

  it("refuses to build a query without an organization", () => {
    expect(() => clientProposalFilter("")).toThrow();
  });
});

describe("money", () => {
  it("parses amounts into whole minor units", () => {
    expect(parseMoneyToMinor("1500")).toBe(150_000);
    expect(parseMoneyToMinor("1,500.5")).toBe(150_050);
    expect(parseMoneyToMinor(" 12.34 ")).toBe(1_234);
    expect(parseMoneyToMinor("0.05")).toBe(5);
  });

  it("rejects zero, negatives, too many decimals, exponents and text", () => {
    for (const bad of [
      "",
      "0",
      "0.00",
      "-5",
      "12.345",
      "1e3",
      "abc",
      "1.5.2",
      "1,5,0.00x",
      "99999999999999",
    ]) {
      expect(parseMoneyToMinor(bad), bad).toBeNull();
    }
  });

  it("formats and round-trips", () => {
    expect(formatMoney(150_050, "USD")).toBe("$1,500.50");
    expect(minorToInput(150_050)).toBe("1500.50");
    expect(parseMoneyToMinor(minorToInput(150_050))).toBe(150_050);
  });
});

describe("proposal input", () => {
  const valid = {
    title: "Booking platform for clinics",
    summary: "A web application for appointment booking.",
    scope: "We will design, build and deploy a booking application with staff and patient logins.",
    deliverables: "- Design\n- Working application\n\n* Deployment",
    assumptions: "The client supplies content.\nOne round of revisions.",
    exclusions: "",
    timelineSummary: "Design in weeks 1-2, build in weeks 3-8.",
    estimatedWeeks: "8",
    currency: "USD",
    totalAmount: "1,500.50",
    paymentTerms: "50% up front, 50% on delivery.",
  };

  it("accepts a valid proposal and converts the text fields", () => {
    const parsed = proposalInputSchema.parse(valid);
    expect(parsed.deliverables).toEqual(["Design", "Working application", "Deployment"]);
    expect(parsed.assumptions).toEqual(["The client supplies content.", "One round of revisions."]);
    expect(parsed.exclusions).toEqual([]);
    expect(parsed.estimatedWeeks).toBe(8);
    expect(parsed.totalAmount).toBe(150_050);
  });

  it("splits lines and strips bullet marks", () => {
    expect(splitLines("- a\r\n\r\n  * b \n• c\nplain")).toEqual(["a", "b", "c", "plain"]);
  });

  it("requires at least one deliverable and a valid price and duration", () => {
    expect(proposalInputSchema.safeParse({ ...valid, deliverables: "  \n " }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...valid, totalAmount: "free" }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...valid, totalAmount: "0" }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...valid, estimatedWeeks: "0" }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...valid, estimatedWeeks: "105" }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...valid, estimatedWeeks: "2.5" }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...valid, estimatedWeeks: "" }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...valid, currency: "BTC" }).success).toBe(false);
  });

  it("enforces size limits on lists and text", () => {
    expect(proposalInputSchema.safeParse({ ...valid, deliverables: "x\n".repeat(21) }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...valid, deliverables: "x".repeat(201) }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...valid, scope: "x".repeat(8001) }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...valid, title: "ab" }).success).toBe(false);
  });

  it("rejects unexpected fields such as a forged status or organization", () => {
    expect(proposalInputSchema.safeParse({ ...valid, status: "accepted" }).success).toBe(false);
    expect(proposalInputSchema.safeParse({ ...valid, organizationId: ORG }).success).toBe(false);
  });

  it("ignores framework and forged form entries", () => {
    const fd = new FormData();
    for (const [key, value] of Object.entries(valid)) fd.set(key, value);
    fd.set("$ACTION_ID_x", "1");
    fd.set("status", "accepted");
    fd.set("organizationId", ORG);
    const picked = pickFields(fd, PROPOSAL_FIELDS);
    expect(Object.keys(picked).sort()).toEqual([...PROPOSAL_FIELDS].sort());
    expect(proposalInputSchema.safeParse(picked).success).toBe(true);
  });
});

describe("ids and staff actions", () => {
  it("validates lead and proposal ids and staff transitions", () => {
    expect(createProposalSchema.safeParse({ leadId: ID }).success).toBe(true);
    expect(createProposalSchema.safeParse({ leadId: "nope" }).success).toBe(false);
    expect(staffTransitionSchema.safeParse({ proposalId: ID, to: "sent" }).success).toBe(true);
    // Staff can never push a proposal to accepted or declined, even by forging the form.
    expect(staffTransitionSchema.safeParse({ proposalId: ID, to: "accepted" }).success).toBe(false);
    expect(staffTransitionSchema.safeParse({ proposalId: ID, to: "declined" }).success).toBe(false);
  });
});

describe("a client's answer", () => {
  it("needs the authorization confirmation to accept", () => {
    expect(respondSchema.safeParse({ proposalId: ID, decision: "accept" }).success).toBe(false);
    const result = respondSchema.safeParse({ proposalId: ID, decision: "accept" });
    if (!result.success) expect(result.error.issues[0].path).toEqual(["authorized"]);
    expect(respondSchema.safeParse({ proposalId: ID, decision: "accept", authorized: "on" }).success).toBe(
      true,
    );
  });

  it("lets a client decline with or without a reason", () => {
    expect(respondSchema.safeParse({ proposalId: ID, decision: "decline" }).success).toBe(true);
    expect(
      respondSchema.parse({ proposalId: ID, decision: "decline", reason: "  Too expensive " }).reason,
    ).toBe("Too expensive");
    expect(respondSchema.parse({ proposalId: ID, decision: "decline", reason: "" }).reason).toBeUndefined();
  });

  it("rejects forged values and an overlong reason", () => {
    expect(respondSchema.safeParse({ proposalId: ID, decision: "withdraw" }).success).toBe(false);
    expect(respondSchema.safeParse({ proposalId: "x", decision: "decline" }).success).toBe(false);
    expect(
      respondSchema.safeParse({ proposalId: ID, decision: "decline", reason: "x".repeat(1001) }).success,
    ).toBe(false);
    expect(respondSchema.safeParse({ proposalId: ID, decision: "accept", authorized: "yes" }).success).toBe(
      false,
    );
    const fd = new FormData();
    fd.set("proposalId", ID);
    fd.set("decision", "decline");
    fd.set("organizationId", ORG);
    expect(Object.keys(pickFields(fd, RESPOND_FIELDS)).sort()).toEqual(["decision", "proposalId"]);
  });
});

describe("proposal codes", () => {
  it("are readable, prefixed and unique", () => {
    const codes = new Set(Array.from({ length: 300 }, generateProposalCode));
    expect(codes.size).toBe(300);
    for (const code of codes) expect(code).toMatch(/^PRP-[A-HJKMNP-Z2-9]{8}$/);
  });
});
