import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const notFound = (page: Page) => page.getByRole("heading", { name: "Page not found" });

test.describe("media library access", () => {
  test("only content editors can open it", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/media");
    await expect(notFound(page)).toBeVisible();
  });

  test("a content manager sees the seeded image and its usage", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/media");
    await expect(page.getByRole("heading", { name: "Media library" })).toBeVisible();
    await expect(page.getByText("e2e-sample.jpg")).toBeVisible();
    await expect(page.getByText("Not used yet")).toBeVisible();
  });
});

test.describe("uploading", () => {
  test("a file of the wrong type is refused in the browser, before anything is sent", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/media");
    await page.locator('input[type="file"]').setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
    await page.getByLabel(/^Description/).fill("A text file that should be refused");
    await page.getByRole("button", { name: "Upload image" }).click();
    await expect(page.getByText("Choose a JPEG, PNG or WebP image.")).toBeVisible();
  });

  test("a description is required", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/media");
    await page.locator('input[type="file"]').setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: Buffer.from("not really a png, but the browser checks only the type"),
    });
    await page.getByRole("button", { name: "Upload image" }).click();
    await expect(page.getByText("Describe the image in a few words")).toBeVisible();
  });
});

test.describe("using a library image", () => {
  test("choose it for a service, publish, and it reaches the public page and blocks archiving", async ({
    page,
  }) => {
    await signIn(page, E2E_ACCOUNTS.content.email);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/content/services/new");
    await page.getByLabel(/^Title/).fill("E2E Picture Service");
    await page.getByLabel(/URL slug/).fill("e2e-picture-service");
    await page.getByRole("button", { name: "Choose image" }).first().click();
    await page.getByRole("button", { name: /E2E sample image/ }).click();
    await expect(page.getByText("E2E sample image").first()).toBeVisible();
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/services\/[a-f0-9]{24}$/);
    const editUrl = page.url();

    await page.getByLabel(/^Summary/).fill("A service with a picture, used to test the media library.");
    await page
      .getByLabel(/^Description/)
      .fill("This description is long enough to pass the publishing checks for a service in the test suite.");
    await page.getByLabel(/What you get/).fill("A picture");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved")).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published. It is live on the website now.")).toBeVisible();

    // The public page carries the image and its description.
    await page.goto("/services/e2e-picture-service");
    await expect(page.getByRole("heading", { name: "E2E Picture Service" })).toBeVisible();
    await expect(page.getByAltText("E2E sample image")).toHaveCount(1);

    // The library now shows it is in use, and refuses to archive it.
    await page.goto("/admin/media");
    await expect(page.getByText("Used by 1 content item")).toBeVisible();
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(
      page.getByText(/Used by 1 content item\. Remove it from them before archiving/),
    ).toBeVisible();

    // Tidy up so later tests see the sample services again.
    await page.goto(editUrl);
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText(/Unpublished/)).toBeVisible();
  });
});
