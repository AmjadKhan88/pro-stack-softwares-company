import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_IDS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const notFound = (page: Page) => page.getByRole("heading", { name: "Page not found" });

test.describe("developers see only the projects they are assigned to", () => {
  test("the list contains the assigned project and nothing else", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.developer.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/projects");
    await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E Project A/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E Project B/ })).toHaveCount(0);
  });

  test("opening an unassigned project by URL is a 404 and reveals nothing", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.developer.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto(`/admin/projects/${E2E_IDS.projectB}`);
    await expect(notFound(page)).toBeVisible();
    await expect(page.getByText("E2E Project B")).toHaveCount(0);
    await expect(page.getByText("Milestone B secret")).toHaveCount(0);
  });

  test("they can read an assigned project but not change it", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.developer.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto(`/admin/projects/${E2E_IDS.projectA}`);
    await expect(page.getByRole("heading", { name: "E2E Project A" })).toBeVisible();
    await expect(page.getByText("Hidden milestone A")).toBeVisible(); // staff see internal items
    await expect(page.getByRole("button", { name: "Add milestone" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add deliverable" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Remove .* from the team/ })).toHaveCount(0);
    await expect(page.getByText("E2E Developer")).toBeVisible(); // the team list
  });

  test("their menu and URLs hide the areas they have no permission for", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.developer.email);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "Projects" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Leads" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Users & roles" })).toHaveCount(0);

    for (const path of [
      "/admin/leads",
      "/admin/proposals",
      "/admin/clients",
      "/admin/users",
      "/admin/audit-logs",
    ]) {
      await page.goto(path);
      await expect(notFound(page)).toBeVisible();
    }
  });
});

test.describe("project managers manage the team", () => {
  test("adding and removing a developer changes what they can see", async ({ page, browser }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);

    const developerContext = await browser.newContext();
    const developer = await developerContext.newPage();
    await signIn(developer, E2E_ACCOUNTS.developer.email);
    await expect(developer).toHaveURL(/\/admin$/);

    // Not on project B yet: 404.
    await developer.goto(`/admin/projects/${E2E_IDS.projectB}`);
    await expect(notFound(developer)).toBeVisible();

    // The project manager adds the developer to project B.
    await page.goto(`/admin/projects/${E2E_IDS.projectB}`);
    await page.getByLabel("Team member").selectOption({ label: "E2E Developer (Developer)" });
    await page.getByRole("button", { name: "Add to team" }).click();
    await expect(page.getByRole("button", { name: "Remove E2E Developer from the team" })).toBeVisible();

    // Now the developer can read it.
    await developer.goto(`/admin/projects/${E2E_IDS.projectB}`);
    await expect(developer.getByRole("heading", { name: "E2E Project B" })).toBeVisible();

    // Removing them takes the access away again.
    await page.getByRole("button", { name: "Remove E2E Developer from the team" }).click();
    await expect(page.getByRole("button", { name: "Remove E2E Developer from the team" })).toHaveCount(0);
    await developer.goto(`/admin/projects/${E2E_IDS.projectB}`);
    await expect(notFound(developer)).toBeVisible();

    await developerContext.close();
  });
});
