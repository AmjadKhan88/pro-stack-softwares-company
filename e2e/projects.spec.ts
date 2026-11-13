import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_IDS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const notFound = (page: Page) => page.getByRole("heading", { name: "Page not found" });

test.describe("client isolation", () => {
  test("a client lists only their own organization's projects and proposals", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);

    await page.goto("/portal/projects");
    await expect(page.getByRole("link", { name: /E2E Project A/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E Project B/ })).toHaveCount(0);

    await page.goto("/portal/proposals");
    await expect(page.getByRole("link", { name: /Sent proposal for A/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sent proposal for B/ })).toHaveCount(0);
    // Drafts are never shown to clients, even their own organization's.
    await expect(page.getByRole("link", { name: /Draft proposal for A/ })).toHaveCount(0);
  });

  test("a client cannot open another organization's project or proposal by URL", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);

    await page.goto(`/portal/projects/${E2E_IDS.projectB}`);
    await expect(notFound(page)).toBeVisible();
    await expect(page.getByText("E2E Project B")).toHaveCount(0);

    await page.goto(`/portal/proposals/${E2E_IDS.proposalSentB}`);
    await expect(notFound(page)).toBeVisible();

    // Their own organization's draft is hidden from them too.
    await page.goto(`/portal/proposals/${E2E_IDS.proposalDraftA}`);
    await expect(notFound(page)).toBeVisible();
  });

  test("the same rules protect the other client in the other direction", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.clientB.email);
    await expect(page).toHaveURL(/\/portal$/);

    await page.goto(`/portal/projects/${E2E_IDS.projectA}`);
    await expect(notFound(page)).toBeVisible();
    await page.goto("/portal/projects");
    await expect(page.getByRole("link", { name: /E2E Project B/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E Project A/ })).toHaveCount(0);
  });

  test("a client sees visible milestones and deliverables but never hidden ones", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);

    await page.goto(`/portal/projects/${E2E_IDS.projectA}`);
    await expect(page.getByRole("heading", { name: "E2E Project A" })).toBeVisible();
    await expect(page.getByText("Visible milestone A")).toBeVisible();
    await expect(page.getByText("Visible deliverable A")).toBeVisible();
    await expect(page.getByText("Hidden milestone A")).toHaveCount(0);
    await expect(page.getByText("Hidden deliverable A")).toHaveCount(0);
  });
});

test.describe("converting a proposal", () => {
  test("a project manager turns an accepted proposal into a project and the lead becomes won", async ({
    page,
  }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto(`/admin/proposals/${E2E_IDS.proposalAcceptedA}`);
    await page.getByRole("button", { name: "Convert to project" }).click();
    await expect(page).toHaveURL(/\/admin\/projects\/[a-f0-9]{24}$/);
    await expect(page.getByRole("heading", { name: "Accepted proposal for A" })).toBeVisible();
    // The proposal's deliverables were copied into the project.
    await expect(page.getByText("Working application")).toBeVisible();

    await page.goto(`/admin/leads/${E2E_IDS.leadQualified}`);
    await expect(page.getByText("Won", { exact: true }).first()).toBeVisible();

    // It cannot be converted a second time.
    await page.goto(`/admin/proposals/${E2E_IDS.proposalAcceptedA}`);
    await expect(page.getByRole("button", { name: "Convert to project" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Open the project/ })).toBeVisible();
  });
});
