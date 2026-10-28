import { test, expect } from "@playwright/test";
import { setup, login } from "./support/api";
test("browses status filters and saved lot details", async ({ page }) => {
  const { filters } = await setup(page);
  await page.goto("/lots");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  await expect.poll(() => filters.includes("open")).toBe(true);
  await page.getByRole("link", { name: /Sunday afternoon/ }).click();
  await expect(
    page.getByRole("heading", { name: "Sunday afternoon" }),
  ).toBeVisible();
  await expect(page.getByText("Oil on canvas")).toBeVisible();
  await expect(
    page.getByText(
      "Bid placement is currently available through the API only.",
    ),
  ).toBeVisible();
});
test("protects wallet and deposits without exposing tokens in storage", async ({
  page,
}) => {
  const { deposits } = await setup(page);
  await page.goto("/wallet");
  await expect(page).toHaveURL(/login/);
  await login(page);
  await page.getByLabel("Amount (USD)").fill("50.00");
  await page.getByRole("button", { name: "Add funds", exact: true }).click();
  await expect(page.getByText("USD 130.00")).toBeVisible();
  expect(deposits).toHaveLength(1);
  expect(deposits[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  await page.screenshot({
    path: "/tmp/auction-wallet-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/login/);
});
test("retains retry key after uncertain failure and navigation", async ({
  page,
}) => {
  const { deposits } = await setup(page, { failFirst: true });
  await login(page);
  await page.getByLabel("Amount (USD)").fill("50.00");
  await page.getByRole("button", { name: "Add funds", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Cannot reach");
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await page.getByRole("link", { name: "Wallet", exact: true }).click();
  await expect(page.getByLabel("Amount (USD)")).toHaveValue("$50.00");
  await page.getByRole("button", { name: "Retry deposit" }).click();
  await expect(page.getByText("USD 130.00")).toBeVisible();
  expect(deposits[0]).toEqual(deposits[1]);
});
test("does not re-deposit after receipt succeeds but balance refresh fails", async ({
  page,
}) => {
  const { deposits } = await setup(page, { failBalanceAfterDeposit: true });
  await login(page);
  await page.getByLabel("Amount (USD)").fill("50.00");
  await page.getByRole("button", { name: "Add funds", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Deposit recorded");
  await page.getByRole("button", { name: "Refresh balance" }).click();
  expect(deposits).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Retry deposit" })).toHaveCount(
    0,
  );
});
test("auctioneer sees balances but no deposit form", async ({ page }) => {
  await setup(page, { role: "auctioneer" });
  await login(page);
  await expect(
    page.getByText("Deposits are available to bidder accounts only.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount (USD)")).toHaveCount(0);
});
test("registration submits selected role, then signs in", async ({ page }) => {
  await setup(page);
  await page.goto("/login");
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Test Bidder");
  await page.getByLabel("Email", { exact: true }).fill("bidder@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  const sent = page.waitForRequest((req) =>
    req.url().endsWith("/api/auth/register"),
  );
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  expect((await sent).postDataJSON().role).toBe("bidder");
  await expect(page).toHaveURL(/wallet/);
});
test("shows empty state and works on mobile without overflow", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/lots?**", (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, limit: 9 } }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lots");
  await expect(
    page.getByRole("heading", { name: "No lots here yet" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/auction-mobile.png", fullPage: true });
});
test("expired JWT clears the session and asks for login", async ({ page }) => {
  await setup(page);
  await login(page);
  await page.route("**/api/wallet", (route) =>
    route.fulfill({ status: 401, json: { message: "Unauthorized" } }),
  );
  await page.getByRole("button", { name: "Refresh balance" }).click();
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByText("Your session expired. Please sign in again."),
  ).toBeVisible();
});
