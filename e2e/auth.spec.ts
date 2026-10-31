import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCOUNTS, E2E_INVITEE, E2E_INVITE_TOKEN, E2E_PASSWORD } from "./users";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("signed-out visitors", () => {
  test("are sent to sign-in for the private areas", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/login\?next=%2Fportal/);
  });

  test("get a generic error for a wrong password", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email, "definitely-the-wrong-password");
    await expect(page.getByRole("alert")).toHaveText("Incorrect email or password.");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("password reset", () => {
  test("gives the same answer whether or not the account exists", async ({ page }) => {
    const answers: string[] = [];
    for (const email of ["nobody@e2e.test", E2E_ACCOUNTS.client.email]) {
      await page.goto("/forgot-password");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByRole("button", { name: "Send reset link" }).click();
      const status = page.getByRole("status");
      await expect(status).toContainText("If an account exists");
      answers.push((await status.textContent()) ?? "");
    }
    expect(answers[0]).toBe(answers[1]);
  });

  test("explains an invalid reset link", async ({ page }) => {
    await page.goto("/reset-password?token=not-a-real-token");
    await page.getByLabel("New password", { exact: true }).fill("A-brand-new-password-1");
    await page.getByLabel("Repeat new password", { exact: true }).fill("A-brand-new-password-1");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByRole("alert")).toContainText("invalid or has expired");
  });
});

test.describe("access control", () => {
  test("a client reaches the portal and is kept out of admin", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.client.email, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/portal$/);
    await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/portal$/);
    await expect(page.getByRole("heading", { name: "Overview" })).toHaveCount(0);
  });

  test("staff reach admin and are kept out of the client portal", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.support.email, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/portal");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("an admin without two-factor is forced to set it up first", async ({ page }) => {
    await signIn(page, E2E_ACCOUNTS.admin.email, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/security\/two-factor/);
    await expect(page.getByRole("heading", { name: "Set up two-factor authentication" })).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/security\/two-factor/);
  });
});

test.describe("invitations", () => {
  test("a valid link creates a client account once, then stops working", async ({ page }) => {
    await page.goto(`/accept-invite?token=${E2E_INVITE_TOKEN}`);
    await expect(page.getByRole("heading", { name: "Accept your invitation" })).toBeVisible();
    await expect(page.getByText(E2E_INVITEE.email)).toBeVisible();

    await page.getByLabel("Your name", { exact: true }).fill("Invited Client");
    await page.getByLabel("Choose a password", { exact: true }).fill("An-invited-password-1");
    await page.getByLabel("Repeat password", { exact: true }).fill("An-invited-password-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/login\?invited=1/);
    await expect(page.getByRole("status")).toContainText("Your account is ready");

    await signIn(page, E2E_INVITEE.email, "An-invited-password-1");
    await expect(page).toHaveURL(/\/portal$/);

    await page.context().clearCookies();
    await page.goto(`/accept-invite?token=${E2E_INVITE_TOKEN}`);
    await expect(page.getByRole("heading", { name: "Invitation not valid" })).toBeVisible();
  });

  test("a made-up link is rejected", async ({ page }) => {
    await page.goto("/accept-invite?token=this-token-does-not-exist-at-all-0000");
    await expect(page.getByRole("heading", { name: "Invitation not valid" })).toBeVisible();
  });
});
