import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("searching lists", () => {
  test("a project manager can search projects by title", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/projects");
    await expect(page.getByRole("link", { name: "E2E Project A" })).toBeVisible();
    await expect(page.getByRole("link", { name: "E2E Project B" })).toBeVisible();

    await page.getByLabel("Search").fill("Project A");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=Project\+A/);
    await expect(page.getByRole("link", { name: "E2E Project A" })).toBeVisible();
    await expect(page.getByRole("link", { name: "E2E Project B" })).toHaveCount(0);

    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page.getByRole("link", { name: "E2E Project B" })).toBeVisible();
  });

  test("a developer's search can never reach a project they are not assigned to", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.developer.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/projects?q=E2E+Project");
    await expect(page.getByRole("link", { name: "E2E Project A" })).toBeVisible();
    await expect(page.getByRole("link", { name: "E2E Project B" })).toHaveCount(0);

    await page.goto("/admin/projects?q=Project+B");
    await expect(page.getByText("No projects match")).toBeVisible();
  });

  test("proposals can be searched by title", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/proposals?q=for+B");
    await expect(page.getByRole("link", { name: "Sent proposal for B" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sent proposal for A" })).toHaveCount(0);
  });

  test("hostile or invalid address-bar values do not break the page", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/projects?status=%24ne&page=-3&q=%5B");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await page.goto("/admin/proposals?status[$ne]=draft&page=999999");
    await expect(page.getByRole("heading", { name: "Proposals" })).toBeVisible();
    await page.goto("/admin/clients?q=.*(a%2B)%2B$");
    await expect(page.getByRole("heading", { name: "Client organizations" })).toBeVisible();
  });
});
