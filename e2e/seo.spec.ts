import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const notFound = (page: Page) => page.getByRole("heading", { name: "Page not found" });

test.describe("SEO overview", () => {
  test("only content editors can open it", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/seo");
    await expect(notFound(page)).toBeVisible();
  });

  test("a published page is listed with what to fix, and a hidden one is marked", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/content/services/new");
    await page.getByLabel(/^Title/).fill("E2E Seo Check");
    await page.getByLabel(/URL slug/).fill("e2e-seo-check");
    await page.getByLabel(/^Summary/).fill("A service used to test the SEO overview page in the test suite.");
    await page
      .getByLabel(/^Description/)
      .fill("This description is long enough to pass the publishing checks for a service in the test suite.");
    await page.getByLabel(/What you get/).fill("A check");
    await page.getByLabel(/Hide this page from search engines/).check();
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/services\/[a-f0-9]{24}$/);
    const editUrl = page.url();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published. It is live on the website now.")).toBeVisible();

    await page.goto("/admin/seo");
    await expect(page.getByRole("heading", { name: "SEO overview" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "E2E Seo Check" });
    await expect(row).toContainText("/services/e2e-seo-check");
    await expect(row).toContainText("Hidden");
    await expect(row).toContainText("Hidden from search engines");

    // Show it to search engines: now the missing description and picture are pointed out.
    await page.goto(editUrl);
    await page.getByLabel(/Hide this page from search engines/).uncheck();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved")).toBeVisible();
    await page.getByRole("button", { name: "Publish changes" }).click();
    await expect(page.getByText("Published. It is live on the website now.")).toBeVisible();

    await page.goto("/admin/seo");
    const listed = page.getByRole("row").filter({ hasText: "E2E Seo Check" });
    await expect(listed).toContainText("Listed");
    await expect(listed).toContainText("No custom description");
    await expect(listed).toContainText("No sharing image");

    // Tidy up.
    await page.goto(editUrl);
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText(/Unpublished/)).toBeVisible();
  });
});
