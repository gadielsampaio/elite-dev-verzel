import { test, expect, type Page } from "@playwright/test";
import { setup } from "./support/api";
async function fill(page: Page) {
  await page.getByLabel("FULL NAME", { exact: true }).fill("New member");
  await page
    .getByLabel("EMAIL ADDRESS", { exact: true })
    .fill("new@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .getByLabel("CONFIRM PASSWORD", { exact: true })
    .fill("test-password-123");
}
for (const role of ["bidder", "auctioneer"])
  test(`registers ${role} and logs in using existing session`, async ({
    page,
  }) => {
    await setup(page, { role });
    let created = 0;
    await page.route("**/api/auth/register", async (route) => {
      created++;
      expect(route.request().postDataJSON()).toEqual({
        name: "New member",
        email: "new@example.com",
        password: "test-password-123",
        role,
      });
      await route.fallback();
    });
    await page.goto("/#/login");
    await page.locator('a[href="/#/register"]').click();
    await fill(page);
    if (role === "auctioneer")
      await page.getByRole("radio", { name: /AUCTIONEER/ }).check();
    await page
      .getByRole("button", { name: "CREATE ACCOUNT", exact: true })
      .click();
    await expect(page.locator("#catalog")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(created).toBe(1);
  });
test("field errors block requests and registration conflicts remain retryable", async ({
  page,
}) => {
  await setup(page);
  let requests = 0;
  await page.route("**/api/auth/register", (route) => {
    requests++;
    return route.fulfill({
      status: 409,
      json: { message: "Email already registered" },
    });
  });
  await page.goto("/#/register");
  const submit = page.getByRole("button", {
    name: "CREATE ACCOUNT",
    exact: true,
  });
  await submit.click();
  await expect(page.getByLabel("FULL NAME", { exact: true })).toBeFocused();
  await expect(page.locator('[data-slot="field-error"]')).toHaveCount(3);
  await fill(page);
  await page.getByLabel("PASSWORD", { exact: true }).fill("short");
  await submit.click();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await page.getByLabel("PASSWORD", { exact: true }).fill("é".repeat(37));
  await submit.click();
  await expect(
    page.getByText("Password must be at most 72 UTF-8 bytes."),
  ).toBeVisible();
  expect(requests).toBe(0);
  await fill(page);
  await submit.click();
  await expect(page.getByRole("alert")).toHaveText("Email already registered");
  await expect(submit).toBeEnabled();
  expect(requests).toBe(1);
});
test("created account is never registered twice after automatic login failure", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem("haus-sampaio-theme", "dark"),
  );
  let registrations = 0;
  await page.route("**/api/auth/register", async (route) => {
    registrations++;
    await route.fallback();
  });
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 503, json: { message: "Try later" } }),
  );
  await page.goto("/#/register");
  await fill(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page
    .getByRole("button", { name: "CREATE ACCOUNT", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Account created. Please log in to continue.",
  );
  await expect(page.locator("#shadcn-register-form")).toHaveCount(0);
  await page
    .getByRole("status")
    .getByRole("link", { name: "LOG IN", exact: true })
    .click();
  await expect(page.locator("#shadcn-login-form")).toBeVisible();
  expect(registrations).toBe(1);
});
