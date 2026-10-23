import { describe, expect, it } from "vitest";
import { getPublicEnv, getServerEnv, requireAuthEnv, requireMongoEnv } from "@/lib/env";

describe("environment validation", () => {
  it("applies safe defaults without secrets", () => {
    expect(getServerEnv({ NODE_ENV: "test" } as NodeJS.ProcessEnv).LOG_LEVEL).toBe("info");
    expect(getPublicEnv({} as NodeJS.ProcessEnv).NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("rejects invalid values with a readable message", () => {
    expect(() => getServerEnv({ LOG_LEVEL: "loud" } as unknown as NodeJS.ProcessEnv)).toThrow(/LOG_LEVEL/);
    expect(() => getPublicEnv({ NEXT_PUBLIC_APP_URL: "nope" } as unknown as NodeJS.ProcessEnv)).toThrow(
      /NEXT_PUBLIC_APP_URL/,
    );
  });

  it("fails loudly (never silently) when MONGODB_URI is missing", () => {
    expect(() => requireMongoEnv({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toThrow(
      /MONGODB_URI is not set/,
    );
    expect(requireMongoEnv({ MONGODB_URI: "mongodb://x" } as unknown as NodeJS.ProcessEnv).uri).toBe(
      "mongodb://x",
    );
  });
});

describe("blank values and auth settings", () => {
  it("treats blank optional values as not set instead of invalid", () => {
    const env = getServerEnv({
      NODE_ENV: "test",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      OWNER_BOOTSTRAP_EMAIL: "",
    } as unknown as NodeJS.ProcessEnv);
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.OWNER_BOOTSTRAP_EMAIL).toBeUndefined();
  });

  it("requires a long auth secret and fails loudly without one", () => {
    expect(() => requireAuthEnv({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toThrow(
      /BETTER_AUTH_SECRET is not set/,
    );
    expect(() => getServerEnv({ BETTER_AUTH_SECRET: "short" } as unknown as NodeJS.ProcessEnv)).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    const ok = requireAuthEnv({
      BETTER_AUTH_SECRET: "a".repeat(32),
      NEXT_PUBLIC_APP_URL: "https://example.com/",
    } as unknown as NodeJS.ProcessEnv);
    expect(ok.baseURL).toBe("https://example.com");
  });
});
