import { describe, expect, it } from "vitest";
import { buildContent, isInternalPath } from "@/features/notifications/content";
import { isAuthorizedJob } from "@/features/notifications/job-auth";
import {
  CATEGORIES,
  KIND_CATEGORY,
  NOTIFICATION_KINDS,
  categoriesFor,
  defaultEmail,
  wantsEmail,
} from "@/features/notifications/types";

const ID = "64b7f1c2a3d4e5f60718293a";

describe("every kind of notification", () => {
  it("has a category, a title, and a link that stays on this website", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(CATEGORIES).toContain(KIND_CATEGORY[kind]);
      const withIds = buildContent(kind, { id: ID, projectId: ID, label: "Something", status: "completed" });
      const withoutIds = buildContent(kind, {});
      for (const content of [withIds, withoutIds]) {
        expect(content.title.length).toBeGreaterThan(3);
        expect(isInternalPath(content.href), `${kind}: ${content.href}`).toBe(true);
      }
    }
  });

  it("sends clients to the portal and staff to the admin", () => {
    expect(buildContent("proposal_sent", { id: ID }).href).toBe(`/portal/proposals/${ID}`);
    expect(buildContent("review_requested", { projectId: ID }).href).toBe(`/portal/projects/${ID}`);
    expect(buildContent("file_shared", {}).href).toBe("/portal/files");
    expect(buildContent("proposal_accepted", { id: ID }).href).toBe(`/admin/proposals/${ID}`);
    expect(buildContent("new_lead", { id: ID }).href).toBe(`/admin/leads/${ID}`);
  });

  it("keeps long names short and shows hostile text only as text", () => {
    const long = buildContent("file_shared", { label: "x".repeat(500) });
    expect(long.body.length).toBeLessThanOrEqual(160);
    const hostile = buildContent("file_shared", { label: '<script>alert(1)</script>"><img src=x>' });
    expect(hostile.href).toBe("/portal/files");
    expect(hostile.title).not.toMatch(/[<>]/);
  });
});

describe("links that are safe to redirect to", () => {
  it("allows only paths on this website", () => {
    for (const ok of ["/", "/portal/files", "/admin/leads/abc?x=1"])
      expect(isInternalPath(ok), ok).toBe(true);
    for (const bad of [
      "//evil.example.com",
      "https://evil.example.com",
      "javascript:alert(1)",
      "/\\evil.example.com",
      "/ spaced",
      "/a\nb",
      "",
      "relative",
      "/" + "x".repeat(300),
      5,
      null,
      undefined,
    ]) {
      expect(isInternalPath(bad), String(bad)).toBe(false);
    }
  });
});

describe("who gets which emails", () => {
  it("gives clients four kinds and staff four, with no overlap in meaning", () => {
    expect([...categoriesFor("client")].sort()).toEqual(["deliverables", "files", "projects", "proposals"]);
    for (const role of ["owner", "admin", "project_manager", "developer", "support", "content_manager"]) {
      expect([...categoriesFor(role)].sort()).toEqual(["deliverables", "leads", "proposals", "team"]);
    }
    expect([...categoriesFor("client")].sort()).toEqual([
      "deliverables",
      "files",
      "messages",
      "projects",
      "proposals",
    ]);
    for (const role of ["owner", "admin", "project_manager", "developer", "support", "content_manager"]) {
      expect([...categoriesFor(role)].sort()).toEqual([
        "deliverables",
        "leads",
        "messages",
        "proposals",
        "team",
      ]);
    }
  });

  it("defaults: clients get everything by email, staff only leads and proposal answers", () => {
    for (const category of categoriesFor("client")) expect(defaultEmail("client", category)).toBe(true);
    expect(defaultEmail("owner", "leads")).toBe(true);
    expect(defaultEmail("owner", "proposals")).toBe(true);
    expect(defaultEmail("owner", "deliverables")).toBe(false);
    expect(defaultEmail("developer", "team")).toBe(false);
    expect(defaultEmail("owner", "messages")).toBe(true);
  });

  it("respects a person's own choice, and never sends a kind their role can't receive", () => {
    expect(wantsEmail("client", "files", { files: false })).toBe(false);
    expect(wantsEmail("owner", "team", { team: true })).toBe(true);
    expect(wantsEmail("client", "leads", { leads: true })).toBe(false);
    expect(wantsEmail("client", "files", {})).toBe(true);
    expect(wantsEmail("client", "files", null)).toBe(true);
    expect(wantsEmail("client", "files", { files: "yes" as unknown as boolean })).toBe(true);
    expect(wantsEmail("nobody", "files", { files: true })).toBe(false);
  });
});

describe("the scheduled email job", () => {
  const secret = "a-long-random-secret-of-24-chars-or-more";

  it("accepts only the exact secret", () => {
    expect(isAuthorizedJob(`Bearer ${secret}`, secret)).toBe(true);
    for (const header of [
      null,
      "",
      secret,
      `Bearer ${secret}x`,
      `Bearer x${secret}`,
      "Bearer ",
      "bearer " + secret,
      `Basic ${secret}`,
    ]) {
      expect(isAuthorizedJob(header, secret), String(header)).toBe(false);
    }
  });

  it("refuses everything when no secret is set, or it is too short", () => {
    expect(isAuthorizedJob(`Bearer ${secret}`, undefined)).toBe(false);
    expect(isAuthorizedJob("Bearer short", "short")).toBe(false);
    expect(isAuthorizedJob("Bearer ", "")).toBe(false);
  });
});
