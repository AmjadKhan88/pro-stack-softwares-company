import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const card = (page: Page, name: string) => page.getByRole("group", { name, exact: true });

test.describe("admin dashboard", () => {
  test("a developer sees project numbers for their assigned project only", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.developer.email);
    await expect(page).toHaveURL(/\/admin$/);

    // Assigned to one of the two active projects, so the count is 1, not 2.
    await expect(card(page, "Active projects")).toContainText("1");
    // Nothing about leads, proposals or clients.
    for (const hidden of [
      "New leads",
      "Qualified leads",
      "Proposals awaiting client",
      "Client organizations",
    ]) {
      await expect(card(page, hidden)).toHaveCount(0);
    }
    await expect(page.getByRole("heading", { name: "Recent activity" })).toHaveCount(0);
  });

  test("a project manager sees the whole picture, but not the audit trail", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);

    await expect(card(page, "Active projects")).toContainText("2");
    await expect(card(page, "Qualified leads")).toBeVisible();
    await expect(card(page, "Ready to convert")).toBeVisible();
    await expect(card(page, "Client organizations")).toContainText("2");
    await expect(page.getByRole("heading", { name: "Recent activity" })).toHaveCount(0);
  });

  test("support sees leads and projects but not proposals", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.support.email);
    await expect(page).toHaveURL(/\/admin$/);

    await expect(card(page, "New leads")).toBeVisible();
    await expect(card(page, "Active projects")).toBeVisible();
    await expect(card(page, "Proposals awaiting client")).toHaveCount(0);
    await expect(card(page, "Client organizations")).toHaveCount(0);
  });
});

test.describe("client dashboard", () => {
  test("shows only the signed-in client's own organization", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);

    await expect(card(page, "Active projects")).toContainText("1");
    await expect(card(page, "Proposals to review")).toContainText("1");
    await expect(page.getByRole("link", { name: /Proposal: Sent proposal for A/ })).toBeVisible();
    await expect(page.getByText("Sent proposal for B")).toHaveCount(0);
    await expect(page.getByText("E2E Project B")).toHaveCount(0);
  });

  test("the other client sees their own numbers, not the first client's", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.clientB.email);
    await expect(page).toHaveURL(/\/portal$/);

    await expect(card(page, "Proposals to review")).toContainText("1");
    await expect(page.getByRole("link", { name: /Proposal: Sent proposal for B/ })).toBeVisible();
    await expect(page.getByText("Sent proposal for A")).toHaveCount(0);
    await expect(page.getByText("E2E Project A")).toHaveCount(0);
  });
});
