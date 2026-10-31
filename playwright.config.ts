import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  // One worker, no retries: sign-in is rate limited (5 per minute), so tests must run in order, once.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build + start (more stable than the dev server). Stop `npm run dev` first.
    command: "npm run e2e:serve",
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ...(process.env as Record<string, string>),
      MONGODB_DB_NAME: "prostackcreations_e2e",
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
    },
  },
});
