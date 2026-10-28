// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

describe("proxy (optimistic signed-out redirect)", () => {
  it("redirects visitors without a session cookie to login, remembering the page", () => {
    const response = proxy(new NextRequest("http://localhost:3000/admin/projects?tab=1"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/admin/projects?tab=1");
  });

  it("lets requests that carry a session cookie continue to the real server-side checks", () => {
    const request = new NextRequest("http://localhost:3000/portal", {
      headers: { cookie: "better-auth.session_token=abc.def" },
    });
    expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
  });

  it("only covers the private areas, never the public site or the auth pages", () => {
    expect(config.matcher).toEqual(["/admin/:path*", "/portal/:path*", "/security/:path*", "/no-access"]);
  });
});