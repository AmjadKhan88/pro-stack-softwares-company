import { describe, expect, it } from "vitest";
import { getPublicEnv, getServerEnv, requireMongoEnv } from "@/lib/env";

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
