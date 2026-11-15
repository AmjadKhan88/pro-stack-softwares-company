import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_IDS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const notFound = (page: Page) => page.getByRole("heading", { name: "Page not found" });

test.describe("disabled accounts", () => {
  test("cannot sign in", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.disabled.email);
    await expect(page.getByRole("alert")).toContainText("This account has been disabled");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("account administration is limited to admins and the owner", () => {
  test("a project manager cannot open the user screens", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/users");
    await expect(notFound(page)).toBeVisible();
    await page.goto(`/admin/users/${E2E_IDS.orgA}`);
    await expect(notFound(page)).toBeVisible();
  });
});

test.describe("linking an existing client account", () => {
  test("a project manager links an unlinked client and they then see the organization", async ({
    page,
    browser,
  }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);

    // Before: the unlinked client has an empty portal.
    const clientContext = await browser.newContext();
    const client = await clientContext.newPage();
    await signIn(client, E2E_ACCOUNTS.clientC.email);
    await expect(client).toHaveURL(/\/portal$/);
    await expect(client.getByText("Your account isn't linked to an organization yet")).toBeVisible();

    // The project manager links the account to organization A.
    await page.goto(`/admin/clients/${E2E_IDS.orgA}`);
    await page.getByLabel("Client account").selectOption({ label: "E2E Client C (client-c@e2e.test)" });
    await page.getByRole("button", { name: "Link account" }).click();
    await expect(page.getByText("Account linked")).toBeVisible();
    await expect(page.getByRole("cell", { name: "client-c@e2e.test" })).toBeVisible();

    // After: the client sees the organization.
    await client.goto("/portal");
    await expect(client.getByText("E2E Org A")).toBeVisible();
    await expect(client.getByText("Your account isn't linked to an organization yet")).toHaveCount(0);

    await clientContext.close();
  });
});
