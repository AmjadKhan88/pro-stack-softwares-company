import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_IDS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const download = (id: string) => `/api/files/${id}`;

// The test files are not really stored in Cloudinary. So a request that is ALLOWED gets as far as asking
// Cloudinary and fails there (502), while a request that is NOT allowed is refused first (404 or 401).
const ALLOWED_BUT_FILE_MISSING = 502;

test.describe("who can download", () => {
  test("a signed-out visitor is told to sign in", async ({ request }) => {
    expect((await request.get(download(E2E_IDS.fileVisible))).status()).toBe(401);
  });

  test("a client can reach only their own organization's visible files", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);

    expect((await page.request.get(download(E2E_IDS.fileVisible))).status()).toBe(ALLOWED_BUT_FILE_MISSING);
    for (const id of [
      E2E_IDS.fileHidden, // not shown to clients
      E2E_IDS.fileOnHiddenDeliverable, // attached to a deliverable the client can't see
      E2E_IDS.fileArchived, // archived
      E2E_IDS.fileOtherOrg, // another organization's file
    ]) {
      expect((await page.request.get(download(id))).status(), id).toBe(404);
    }
    expect((await page.request.get(download("not-an-id"))).status()).toBe(404);
  });

  test("the other client is held to the same rules", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.clientB.email);
    await expect(page).toHaveURL(/\/portal$/);
    expect((await page.request.get(download(E2E_IDS.fileOtherOrg))).status()).toBe(ALLOWED_BUT_FILE_MISSING);
    expect((await page.request.get(download(E2E_IDS.fileVisible))).status()).toBe(404);
  });

  test("staff can reach files on projects they can read; a developer only on their own projects", async ({
    page,
    browser,
  }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);
    // A project manager can reach every file, including hidden and archived ones.
    for (const id of [E2E_IDS.fileVisible, E2E_IDS.fileHidden, E2E_IDS.fileArchived, E2E_IDS.fileOtherOrg]) {
      expect((await page.request.get(download(id))).status(), id).toBe(ALLOWED_BUT_FILE_MISSING);
    }

    const devContext = await browser.newContext();
    const dev = await devContext.newPage();
    await signIn(dev, E2E_ACCOUNTS.developer.email);
    await expect(dev).toHaveURL(/\/admin$/);
    expect((await dev.request.get(download(E2E_IDS.fileHidden))).status()).toBe(ALLOWED_BUT_FILE_MISSING); // assigned to project A
    expect((await dev.request.get(download(E2E_IDS.fileOtherOrg))).status()).toBe(404); // not assigned to project B
    await devContext.close();
  });
});

test.describe("the Files page", () => {
  test("a client sees only what they may download", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);
    await page.goto("/portal/files");
    await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
    await expect(page.getByText("e2e-visible.pdf")).toBeVisible();
    for (const hidden of [
      "e2e-hidden.pdf",
      "e2e-on-hidden-deliverable.pdf",
      "e2e-archived.pdf",
      "e2e-other-org.pdf",
    ]) {
      await expect(page.getByText(hidden)).toHaveCount(0);
    }
  });

  test("a client's project page shows the same files", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);
    await page.goto(`/portal/projects/${E2E_IDS.projectA}`);
    await expect(page.getByText("e2e-visible.pdf")).toBeVisible();
    await expect(page.getByText("e2e-hidden.pdf")).toHaveCount(0);
  });
});

test.describe("staff managing files", () => {
  test("a project manager sees every file with its visibility, and an upload form", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/projects/${E2E_IDS.projectA}`);
    await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
    const hidden = page.getByRole("listitem").filter({ hasText: "e2e-hidden.pdf" });
    await expect(hidden).toContainText("Hidden from client");
    await expect(page.getByRole("listitem").filter({ hasText: "e2e-archived.pdf" })).toContainText(
      "Archived",
    );
    await expect(page.getByRole("button", { name: "Upload file" })).toBeVisible();
  });

  test("a file of the wrong type is refused in the browser, before anything is sent", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/projects/${E2E_IDS.projectA}`);
    await page.locator('input[type="file"]').setInputFiles({
      name: "notes.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("zip"),
    });
    await page.getByRole("button", { name: "Upload file" }).click();
    await expect(page.getByText("Choose a PDF, PNG, JPEG or WebP file.")).toBeVisible();
  });

  test("showing a file to the client makes it appear for them, and hiding it takes it away", async ({
    page,
    browser,
  }) => {
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);
    const clientContext = await browser.newContext();
    const client = await clientContext.newPage();
    await signIn(client, E2E_ACCOUNTS.client.email);
    await expect(client).toHaveURL(/\/portal$/);

    await client.goto("/portal/files");
    await expect(client.getByText("e2e-hidden.pdf")).toHaveCount(0);

    await page.goto(`/admin/projects/${E2E_IDS.projectA}`);
    const row = page.getByRole("listitem").filter({ hasText: "e2e-hidden.pdf" });
    await row.getByRole("button", { name: "Show to client" }).click();
    await expect(row).toContainText("Visible to client");

    await client.goto("/portal/files");
    await expect(client.getByText("e2e-hidden.pdf")).toBeVisible();
    expect((await client.request.get(download(E2E_IDS.fileHidden))).status()).toBe(ALLOWED_BUT_FILE_MISSING);

    // Put it back.
    await page.goto(`/admin/projects/${E2E_IDS.projectA}`);
    await page
      .getByRole("listitem")
      .filter({ hasText: "e2e-hidden.pdf" })
      .getByRole("button", { name: "Hide from client" })
      .click();
    await client.goto("/portal/files");
    await expect(client.getByText("e2e-hidden.pdf")).toHaveCount(0);
    expect((await client.request.get(download(E2E_IDS.fileHidden))).status()).toBe(404);
    await clientContext.close();
  });

  test("a developer can see the files but not change them", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.developer.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/projects/${E2E_IDS.projectA}`);
    await expect(page.getByText("e2e-visible.pdf")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload file" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show to client" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(0);
  });
});
