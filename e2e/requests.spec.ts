import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("client project requests", () => {
  test("the form explains what is missing", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);

    await page.goto("/portal/requests/new");
    await page.getByLabel(/Project type/).selectOption("web-app");
    await page.getByLabel(/Project details/).fill("too short");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("at least 20 characters")).toBeVisible();
    // What was typed is kept.
    await expect(page.getByLabel(/Project details/)).toHaveValue("too short");
  });

  test("a request becomes a lead for staff and stays private to its organization", async ({
    page,
    browser,
  }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);

    await page.goto("/portal/requests/new");
    await page.getByLabel(/Project type/).selectOption("web-app");
    await page
      .getByLabel(/Project details/)
      .fill("We would like a dashboard that shows our weekly bookings and revenue.");
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(page.getByText(/received your request/)).toBeVisible();
    const code = (await page.getByText(/^PSC-[A-Z0-9]{8}$/).textContent())?.trim() ?? "";
    expect(code).toMatch(/^PSC-[A-Z0-9]{8}$/);

    // The client sees it, in plain wording.
    await page.goto("/portal/requests");
    await expect(page.getByText(code)).toBeVisible();
    await expect(page.getByText("Received", { exact: true })).toBeVisible();

    // The other organization's client does not.
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await signIn(other, E2E_ACCOUNTS.clientB.email);
    await expect(other).toHaveURL(/\/portal$/);
    await other.goto("/portal/requests");
    await expect(other.getByText(code)).toHaveCount(0);
    await expect(other.getByText("No requests yet")).toBeVisible();
    await otherContext.close();

    // Staff find it in the leads inbox.
    const staffContext = await browser.newContext();
    const staff = await staffContext.newPage();
    await signIn(staff, E2E_ACCOUNTS.pm.email);
    await expect(staff).toHaveURL(/\/admin$/);
    await staff.goto("/admin/leads");
    await expect(staff.getByText(code)).toBeVisible();
    await staffContext.close();
  });
});
