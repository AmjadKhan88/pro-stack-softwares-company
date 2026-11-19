import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const notFound = (page: Page) => page.getByRole("heading", { name: "Page not found" });

test.describe("content permissions", () => {
  test("only content editors reach the content screens", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);
    for (const path of [
      "/admin/content/services",
      "/admin/content/projects",
      "/admin/content/services/new",
    ]) {
      await page.goto(path);
      await expect(notFound(page)).toBeVisible();
    }
  });

  test("a developer cannot either, and their menu has no content links", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.developer.email);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "Services" })).toHaveCount(0);
    await page.goto("/admin/content/projects");
    await expect(notFound(page)).toBeVisible();
  });
});

test.describe("publishing a service", () => {
  test("draft, incomplete publish refused, publish, rename with redirect, unpublish", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);

    // 1. Create an incomplete draft.
    await page.goto("/admin/content/services/new");
    await page.getByLabel(/^Title/).fill("E2E Cloud Migration");
    await page.getByLabel(/URL slug/).fill("e2e-cloud-migration");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/services\/[a-f0-9]{24}$/);
    const editUrl = page.url();

    // A draft is not public.
    await page.goto("/services/e2e-cloud-migration");
    await expect(notFound(page)).toBeVisible();

    // 2. Publishing an incomplete draft is refused, with plain-language reasons.
    await page.goto(editUrl);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Add a description of at least 50 characters.")).toBeVisible();
    await expect(page.getByText("Add at least one deliverable.")).toBeVisible();

    // 3. Complete it, save, publish.
    await page.getByLabel(/^Summary/).fill("Moving your systems to the cloud safely and step by step.");
    await page
      .getByLabel(/^Description/)
      .fill(
        "We plan and carry out a careful migration of your applications and data to the cloud with no surprises.",
      );
    await page.getByLabel(/What you get/).fill("Migration plan\nRehearsed cutover");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved")).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published. It is live on the website now.")).toBeVisible();

    // 4. It is on the public site, and the sample notice is gone from the list.
    await page.goto("/services/e2e-cloud-migration");
    await expect(page.getByRole("heading", { name: "E2E Cloud Migration" })).toBeVisible();
    await page.goto("/services");
    await expect(page.getByRole("link", { name: /E2E Cloud Migration/ })).toBeVisible();
    await expect(page.getByText("Draft service descriptions")).toHaveCount(0);

    // 5. Editing a live item changes only the draft until it is published.
    await page.goto(editUrl);
    await page.getByLabel(/^Title/).fill("E2E Cloud Migration Plus");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved")).toBeVisible();
    await page.goto("/services/e2e-cloud-migration");
    await expect(page.getByRole("heading", { name: "E2E Cloud Migration", exact: true })).toBeVisible();

    // 6. Rename the address and publish: the old address redirects to the new one.
    await page.goto(editUrl);
    await page.getByLabel(/URL slug/).fill("e2e-cloud-migration-plus");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved")).toBeVisible();
    await page.getByRole("button", { name: "Publish changes" }).click();
    await expect(page.getByText("Published. It is live on the website now.")).toBeVisible();
    await page.goto("/services/e2e-cloud-migration");
    await expect(page).toHaveURL(/\/services\/e2e-cloud-migration-plus$/);
    await expect(page.getByRole("heading", { name: "E2E Cloud Migration Plus" })).toBeVisible();

    // 7. Unpublish: the page disappears.
    await page.goto(editUrl);
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText(/Unpublished/)).toBeVisible();
    await page.goto("/services/e2e-cloud-migration-plus");
    await expect(notFound(page)).toBeVisible();
    await page.goto("/services/e2e-cloud-migration");
    await expect(notFound(page)).toBeVisible();
  });

  test("a second editor's save is not silently overwritten", async ({ page, browser }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/content/services/new");
    await page.getByLabel(/^Title/).fill("E2E Conflict Check");
    await page.getByLabel(/URL slug/).fill("e2e-conflict-check");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/services\/[a-f0-9]{24}$/);
    const editUrl = page.url();

    // A second window opens the same draft and saves first.
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await signIn(other, E2E_ACCOUNTS.content.email);
    await expect(other).toHaveURL(/\/admin$/);
    await other.goto(editUrl);
    await other.getByLabel(/^Title/).fill("E2E Conflict Check, edited elsewhere");
    await other.getByRole("button", { name: "Save draft" }).click();
    await expect(other.getByText("Draft saved")).toBeVisible();
    await otherContext.close();

    // The first window is now out of date, so its save is refused.
    await page.getByLabel(/^Title/).fill("E2E Conflict Check, stale");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Someone saved a newer version/)).toBeVisible();
  });
});
