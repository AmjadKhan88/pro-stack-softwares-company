import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const notFound = (page: Page) => page.getByRole("heading", { name: "Page not found" });

test.describe("access", () => {
  test("only content editors reach the new content screens", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);
    for (const path of [
      "/admin/content/blog",
      "/admin/content/pages",
      "/admin/content/faqs",
      "/admin/content/blog/new",
    ]) {
      await page.goto(path);
      await expect(notFound(page)).toBeVisible();
    }
  });
});

test.describe("articles and safe rich text", () => {
  test("unsafe text is shown as words, links are checked, and the article reaches the site", async ({
    page,
  }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/content/blog/new");
    await page.getByLabel(/^Title/).fill("E2E Safe Article");
    await page.getByLabel(/URL slug/).fill("e2e-safe-article");
    await page.getByLabel(/^Category/).fill("Engineering");
    await page.getByLabel(/^Summary/).fill("An article that checks unsafe text is only ever shown as words.");
    await page.getByLabel("Block type").selectOption("richtext");
    await page.getByRole("button", { name: "Add block" }).click();
    await page
      .getByLabel(/^Text \(block 1\)/)
      .fill(
        "## A real heading\n\nHello <script>alert(1)</script> and [bad link](javascript:alert(1)) and [good link](https://example.com).",
      );
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/blog\/[a-f0-9]{24}$/);
    const editUrl = page.url();

    // The blocks survived the save.
    await expect(page.getByLabel(/^Text \(block 1\)/)).toHaveValue(/A real heading/);

    // Not public until published.
    await page.goto("/insights/e2e-safe-article");
    await expect(notFound(page)).toBeVisible();

    await page.goto(editUrl);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published. It is live on the website now.")).toBeVisible();

    await page.goto("/insights/e2e-safe-article");
    await expect(page.getByRole("heading", { name: "E2E Safe Article" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "A real heading" })).toBeVisible();
    // The script tag is words on the page, not a script.
    await expect(page.getByText("<script>alert(1)</script>")).toBeVisible();
    // The unsafe link is plain text; the safe link is a link that opens safely.
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "bad link" })).toHaveCount(0);
    await expect(page.getByText("bad link")).toBeVisible();
    await expect(page.getByRole("link", { name: "good link" })).toHaveAttribute("rel", "noopener noreferrer");

    // It is listed under Insights, and the footer now links there.
    await page.goto("/insights");
    await expect(page.getByRole("link", { name: "E2E Safe Article" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Insights" }),
    ).toBeVisible();

    // Tidy up.
    await page.goto(editUrl);
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText(/Unpublished/)).toBeVisible();
    await page.goto("/insights/e2e-safe-article");
    await expect(notFound(page)).toBeVisible();
  });

  test("a block with a problem is named, and nothing is lost", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/content/blog/new");
    await page.getByLabel(/^Title/).fill("E2E Block Check");
    await page.getByLabel(/URL slug/).fill("e2e-block-check");
    await page.getByLabel("Block type").selectOption("cta");
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByLabel(/^Heading \(block 1\)/).fill("Talk to us");
    await page.getByLabel(/^Button label \(block 1\)/).fill("Go");
    await page.getByLabel(/^Button address \(block 1\)/).fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByText(/Block 1: Use a page on this site/)).toBeVisible();
    // What was typed is still there.
    await expect(page.getByLabel(/^Heading \(block 1\)/)).toHaveValue("Talk to us");
  });
});

test.describe("pages", () => {
  test("a page can't take an address the website already uses", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/content/pages/new");
    await page.getByLabel(/^Title/).fill("Services page");
    await page.getByLabel(/URL slug/).fill("services");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByText("The website already uses that address.")).toBeVisible();
  });

  test("template text with a [[placeholder]] cannot be published; real text can, and the footer links to it", async ({
    page,
  }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/content/pages/new");
    await page.getByLabel(/^Title/).fill("Privacy");
    await page.getByLabel(/URL slug/).fill("privacy");
    await page.getByLabel("Block type").selectOption("richtext");
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByLabel(/^Text \(block 1\)/).fill("We keep your data at [[hosting provider]].");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/pages\/[a-f0-9]{24}$/);
    const editUrl = page.url();

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Replace the placeholder [[hosting provider]]")).toBeVisible();
    await page.goto("/privacy");
    await expect(notFound(page)).toBeVisible();

    await page.goto(editUrl);
    await page
      .getByLabel(/^Text \(block 1\)/)
      .fill("We keep your data safe and only use it to reply to you.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved")).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published. It is live on the website now.")).toBeVisible();

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
    await expect(page.getByText("only use it to reply to you")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Privacy" }),
    ).toBeVisible();

    await page.goto(editUrl);
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText(/Unpublished/)).toBeVisible();
    await page.goto("/privacy");
    await expect(notFound(page)).toBeVisible();
  });
});

test.describe("FAQ entries", () => {
  test("a published entry replaces the sample questions, and unpublishing brings them back", async ({
    page,
  }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/faq");
    await expect(page.getByText("Draft answers.")).toBeVisible();

    await page.goto("/admin/content/faqs/new");
    await page.getByLabel(/^Question/).fill("How long does a typical E2E project take?");
    await page
      .getByLabel(/^Answer/)
      .fill("That depends on the scope. We give an honest estimate in the proposal.");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/faqs\/[a-f0-9]{24}$/);
    const editUrl = page.url();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published. It is live on the website now.")).toBeVisible();

    await page.goto("/faq");
    await expect(page.getByText("How long does a typical E2E project take?")).toBeVisible();
    await expect(page.getByText("Draft answers.")).toHaveCount(0);

    await page.goto(editUrl);
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText(/Unpublished/)).toBeVisible();
    await page.goto("/faq");
    await expect(page.getByText("Draft answers.")).toBeVisible();
  });
});
