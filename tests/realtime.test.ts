import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isBearerMatch } from "../apps/realtime/src/bearer";
import { loadConfig } from "../apps/realtime/src/config";
import { MAX_EMIT_EVENTS, parseEmitBody } from "../apps/realtime/src/emit-body";
import { canJoin } from "../apps/realtime/src/rooms";
import { cleanEventData, parseRoom, projectRoom, userRoom } from "@/lib/realtime/contract";
import {
  MAX_PROJECTS,
  TOKEN_TTL_SECONDS,
  signRealtimeToken,
  verifyRealtimeToken,
} from "@/lib/realtime/token";

const SECRET = "s".repeat(40);
const USER = "64b7f1c2a3d4e5f60718293a";
const OTHER = "64b7f1c2a3d4e5f60718293b";
const PROJECT_A = "64b7f1c2a3d4e5f60718294a";
const PROJECT_B = "64b7f1c2a3d4e5f60718294b";
const NOW = 1_800_000_000;

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("the two copies of the shared files", () => {
  it("are identical, so the website and the live service always agree", () => {
    expect(read("apps/realtime/src/contract.ts")).toBe(read("src/lib/realtime/contract.ts"));
    expect(read("apps/realtime/src/token.ts")).toBe(read("src/lib/realtime/token.ts"));
  });
});

describe("tickets", () => {
  it("a genuine ticket is accepted", () => {
    const { token, expiresAt } = signRealtimeToken({ sub: USER, projects: [PROJECT_A] }, SECRET, NOW);
    expect(expiresAt).toBe(NOW + TOKEN_TTL_SECONDS);
    expect(verifyRealtimeToken(token, SECRET, NOW + 60)).toMatchObject({ sub: USER, projects: [PROJECT_A] });
    expect(
      verifyRealtimeToken(signRealtimeToken({ sub: USER, projects: "all" }, SECRET, NOW).token, SECRET, NOW)
        ?.projects,
    ).toBe("all");
  });

  it("expires after 15 minutes", () => {
    const { token } = signRealtimeToken({ sub: USER, projects: [] }, SECRET, NOW);
    expect(verifyRealtimeToken(token, SECRET, NOW + TOKEN_TTL_SECONDS - 1)).not.toBeNull();
    expect(verifyRealtimeToken(token, SECRET, NOW + TOKEN_TTL_SECONDS)).toBeNull();
    expect(verifyRealtimeToken(token, SECRET, NOW + 100_000)).toBeNull();
  });

  it("rejects a wrong secret, tampering and garbage", () => {
    const { token } = signRealtimeToken({ sub: USER, projects: [PROJECT_A] }, SECRET, NOW);
    expect(verifyRealtimeToken(token, "x".repeat(40), NOW)).toBeNull();
    const [payload, signature] = token.split(".") as [string, string];
    const forged = Buffer.from(
      JSON.stringify({ sub: OTHER, projects: "all", iat: NOW, exp: NOW + 900 }),
    ).toString("base64url");
    expect(verifyRealtimeToken(`${forged}.${signature}`, SECRET, NOW)).toBeNull(); // a new payload with the old signature
    expect(verifyRealtimeToken(`${payload}.${signature.slice(0, -2)}AA`, SECRET, NOW)).toBeNull();
    for (const bad of ["", "abc", "a.b.c", ".", "a.", ".b", null, undefined, 42, {}, "x".repeat(13_000)]) {
      expect(verifyRealtimeToken(bad, SECRET, NOW), String(bad).slice(0, 20)).toBeNull();
    }
  });

  it("refuses a short secret for signing and for checking", () => {
    expect(() => signRealtimeToken({ sub: USER, projects: [] }, "short", NOW)).toThrow();
    const { token } = signRealtimeToken({ sub: USER, projects: [] }, SECRET, NOW);
    expect(verifyRealtimeToken(token, "short", NOW)).toBeNull();
  });

  it("only ever carries a bounded list of valid project ids", () => {
    const many = Array.from({ length: MAX_PROJECTS + 50 }, (_, i) => i.toString(16).padStart(24, "0"));
    const { token } = signRealtimeToken({ sub: USER, projects: many }, SECRET, NOW);
    const claims = verifyRealtimeToken(token, SECRET, NOW);
    expect(Array.isArray(claims?.projects) && claims.projects.length).toBe(MAX_PROJECTS);

    // A hand-made ticket with bad content is refused even with a valid signature.
    const forge = (claims: unknown) => {
      const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
      return `${payload}.${signRealtimeToken({ sub: USER, projects: [] }, SECRET, NOW).token.split(".")[1]}`;
    };
    expect(
      verifyRealtimeToken(forge({ sub: USER, projects: ["nope"], iat: NOW, exp: NOW + 900 }), SECRET, NOW),
    ).toBeNull();
  });
});

describe("rooms", () => {
  const claims = { sub: USER, projects: [PROJECT_A], iat: NOW, exp: NOW + 900 };

  it("parses only the two exact shapes", () => {
    expect(parseRoom(userRoom(USER))).toEqual({ type: "user", id: USER });
    expect(parseRoom(projectRoom(PROJECT_A))).toEqual({ type: "project", id: PROJECT_A });
    for (const bad of [
      "project:*",
      "user:",
      "user:../x",
      `user:${USER.toUpperCase()}`,
      `admin:${USER}`,
      `project:${USER}x`,
      "",
      5,
      null,
      undefined,
    ]) {
      expect(parseRoom(bad), String(bad)).toBeNull();
    }
  });

  it("lets a person join only their own room and the projects on their ticket", () => {
    expect(canJoin(claims, userRoom(USER))).toBe(true);
    expect(canJoin(claims, userRoom(OTHER))).toBe(false);
    expect(canJoin(claims, projectRoom(PROJECT_A))).toBe(true);
    expect(canJoin(claims, projectRoom(PROJECT_B))).toBe(false);
    expect(canJoin(claims, "project:*")).toBe(false);
    expect(canJoin({ ...claims, projects: [] }, projectRoom(PROJECT_A))).toBe(false);
  });

  it('"all" opens every project but still never another person\'s room', () => {
    const staff = { ...claims, projects: "all" as const };
    expect(canJoin(staff, projectRoom(PROJECT_B))).toBe(true);
    expect(canJoin(staff, userRoom(OTHER))).toBe(false);
    expect(canJoin(staff, "everything")).toBe(false);
  });
});

describe("what the website may ask the service to send", () => {
  const good = {
    room: userRoom(USER),
    event: "notification.created",
    data: { id: PROJECT_A, kind: "file_shared" },
  };

  it("accepts the two real events, keeping only ids", () => {
    expect(parseEmitBody({ events: [good] })).toEqual([good]);
    const message = {
      room: projectRoom(PROJECT_A),
      event: "message.created",
      data: { projectId: PROJECT_A, body: "SECRET TEXT", extra: 1 },
    };
    expect(parseEmitBody({ events: [message] })).toEqual([
      { room: projectRoom(PROJECT_A), event: "message.created", data: { projectId: PROJECT_A } },
    ]);
  });

  it("refuses anything else, as a whole", () => {
    for (const bad of [
      null,
      {},
      { events: [] },
      { events: "x" },
      { events: [{ ...good, event: "admin.broadcast" }] },
      { events: [{ ...good, room: projectRoom(PROJECT_A) }] }, // a notification to a project room
      { events: [{ room: userRoom(USER), event: "message.created", data: { projectId: PROJECT_A } }] }, // a message to a person's room
      { events: [{ ...good, room: "project:*" }] },
      { events: [{ ...good, data: { id: "nope", kind: "x" } }] },
      { events: [{ ...good, data: { id: PROJECT_A, kind: "Not Valid!" } }] },
      { events: [good, null] },
      { events: Array.from({ length: MAX_EMIT_EVENTS + 1 }, () => good) },
    ]) {
      expect(parseEmitBody(bad), JSON.stringify(bad)?.slice(0, 60)).toBeNull();
    }
  });

  it("event data can't carry private details", () => {
    expect(cleanEventData("message.created", { projectId: PROJECT_A, text: "hello" })).toEqual({
      projectId: PROJECT_A,
    });
    expect(
      cleanEventData("notification.created", { id: PROJECT_A, kind: "file_shared", title: "Private" }),
    ).toEqual({
      id: PROJECT_A,
      kind: "file_shared",
    });
    expect(cleanEventData("something.else", { id: PROJECT_A })).toBeNull();
  });
});

describe("the service's own passwords and settings", () => {
  const secret = "a".repeat(40);

  it("the emit password must match exactly", () => {
    expect(isBearerMatch(`Bearer ${secret}`, secret)).toBe(true);
    for (const header of [null, "", secret, `Bearer ${secret}x`, `bearer ${secret}`, "Bearer "]) {
      expect(isBearerMatch(header, secret), String(header)).toBe(false);
    }
    expect(isBearerMatch("Bearer short", "short")).toBe(false);
    expect(isBearerMatch(`Bearer ${secret}`, "")).toBe(false);
  });

  it("refuses to start with missing or weak settings, and explains why", () => {
    expect(() => loadConfig({ NODE_ENV: "test" })).toThrow(/REALTIME_TOKEN_SECRET/);
    expect(() =>
      loadConfig({
        NODE_ENV: "test",
        REALTIME_TOKEN_SECRET: secret,
        REALTIME_EMIT_SECRET: secret,
        WEB_ORIGINS: "https://a.com",
      }),
    ).toThrow(/different/);
    expect(() =>
      loadConfig({
        NODE_ENV: "test",
        REALTIME_TOKEN_SECRET: secret,
        REALTIME_EMIT_SECRET: "b".repeat(40),
        WEB_ORIGINS: "https://a.com/",
      }),
    ).toThrow(/no slash/);
    const config = loadConfig({
      NODE_ENV: "test",
      REALTIME_TOKEN_SECRET: secret,
      REALTIME_EMIT_SECRET: "b".repeat(40),
      WEB_ORIGINS: "https://a.com, http://localhost:3000",
      PORT: "4000",
    });
    expect(config).toMatchObject({ port: 4000, origins: ["https://a.com", "http://localhost:3000"] });
  });
});
