import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_IDS, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("who can ask", () => {
  test("a signed-out visitor can't read the unread count or the notification routes", async ({ request }) => {
    expect((await request.get("/api/notifications/summary")).status()).toBe(401);
    expect((await request.get(`/api/notifications/${E2E_IDS.orgA}/open`, { maxRedirects: 0 })).status()).toBe(
      401,
    );
  });

  test("the email job refuses anyone without the secret", async ({ request }) => {
    const status = (await request.post("/api/jobs/notification-emails")).status();
    expect([401, 503]).toContain(status); // 503 when no secret is configured, 401 when one is
  });
});

test.describe("a client is told when a proposal is sent", () => {
  test("the bell counts it, the inbox shows it, opening it marks it read, and no one else can open it", async ({
    page,
    browser,
  }) => {
    // The project manager sends the draft proposal to the client.
    await signIn(page, E2E_ACCOUNTS.pm.email);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/proposals/${E2E_IDS.proposalDraftA}`);
    await page.getByRole("button", { name: "Send to client" }).click();
    await expect(page.getByText(/^Sent\./)).toBeVisible();

    // The client sees an unread notification.
    const clientContext = await browser.newContext();
    const client = await clientContext.newPage();
    await signIn(client, E2E_ACCOUNTS.client.email);
    await expect(client).toHaveURL(/\/portal$/);
    await expect(client.getByRole("link", { name: /^Notifications, \d+ unread$/ })).toBeVisible();

    await client.goto("/portal/notifications");
    const item = client.getByRole("link", { name: /A new proposal is ready/ });
    await expect(item).toBeVisible();
    await expect(item).toContainText("Draft proposal for A");
    const href = await item.getAttribute("href");
    expect(href).toMatch(/^\/api\/notifications\/[a-f0-9]{24}\/open$/);

    // Another organization's client can't use that link: they are simply sent to their own inbox.
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await signIn(other, E2E_ACCOUNTS.clientB.email);
    await expect(other).toHaveURL(/\/portal$/);
    const response = await other.request.get(href as string, { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toContain("/portal/notifications");
    await other.goto("/portal/notifications");
    await expect(other.getByText("A new proposal is ready")).toHaveCount(0);
    await otherContext.close();

    // Opening it takes the client to the proposal and marks it read.
    await item.click();
    await expect(client).toHaveURL(new RegExp(`/portal/proposals/${E2E_IDS.proposalDraftA}$`));
    await client.goto("/portal/notifications");
    await expect(
      client.getByRole("listitem").filter({ hasText: "A new proposal is ready" }),
    ).not.toContainText("New");
    await clientContext.close();
  });

  test("marking everything as read clears the count", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);
    await page.goto("/portal/notifications");
    const markAll = page.getByRole("button", { name: "Mark all as read" });
    if (await markAll.count()) await markAll.click();
    await page.goto("/portal/notifications?filter=unread");
    await expect(page.getByText("No unread notifications")).toBeVisible();
    await page.goto("/portal");
    await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();
  });
});

test.describe("staff are told about a new project request", () => {
  test("a client's request reaches the project manager's inbox", async ({ page, browser }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);
    await page.goto("/portal/requests/new");
    await page.getByLabel(/Project type/).selectOption("web-app");
    await page
      .getByLabel(/Project details/)
      .fill("We would like a dashboard that shows our weekly bookings and revenue.");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText(/received your request/)).toBeVisible();

    const staffContext = await browser.newContext();
    const staff = await staffContext.newPage();
    await signIn(staff, E2E_ACCOUNTS.pm.email);
    await expect(staff).toHaveURL(/\/admin$/);
    await staff.goto("/admin/notifications");
    await expect(staff.getByRole("link", { name: /New project request/ }).first()).toBeVisible();
    // The person who sent it is not told about their own request.
    await page.goto("/portal/notifications");
    await expect(page.getByText("New project request")).toHaveCount(0);
    await staffContext.close();
  });
});

test.describe("email preferences", () => {
  test("a choice is saved and still there after a reload", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email);
    await expect(page).toHaveURL(/\/portal$/);
    await page.goto("/portal/notifications");
    const files = page.getByRole("checkbox", { name: /^Files/ });
    await expect(files).toBeChecked(); // clients get email for everything by default
    await files.uncheck();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /^Files/ })).not.toBeChecked();
    // Put it back.
    await page.getByRole("checkbox", { name: /^Files/ }).check();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  });
});
