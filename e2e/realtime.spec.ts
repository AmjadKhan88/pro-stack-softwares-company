import { expect, test } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_PASSWORD } from "./users";

test("a signed-out visitor can't get a live-updates ticket", async ({ request }) => {
  expect((await request.get("/api/realtime/token")).status()).toBe(401);
});

test("a signed-in person gets a ticket only when live updates are set up", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(E2E_ACCOUNTS.client.email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal$/);

  const response = await page.request.get("/api/realtime/token");
  expect([200, 503]).toContain(response.status());
  expect(response.headers()["cache-control"]).toContain("no-store");
  const text = await response.text();
  if (response.status() === 200) {
    const body = JSON.parse(text) as { token: string; url: string; expiresAt: number };
    expect(body.token.split(".")).toHaveLength(2);
    expect(body.url).toMatch(/^https?:\/\//);
    expect(text).not.toMatch(/secret/i);
  }
});

test("the dashboard works the same when live updates are off", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(E2E_ACCOUNTS.client.email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("link", { name: /^Notifications/ })).toBeVisible();
});
