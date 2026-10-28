import { test, expect, type Page } from "@playwright/test";
import { setup, user } from "./support/api";
const key = "auction-session-token";
async function login(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("seller@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(page.locator(".hs-wallet-grid")).toBeVisible();
}
test("reload restores a verified seller session and sign out clears it", async ({
  page,
}) => {
  await setup(page, { role: "auctioneer" });
  await page.route("**/api/lots/mine?**", (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, limit: 9 } }),
  );
  let profiles = 0;
  await page.route(`**/api/users/${user.id}`, (route) => {
    profiles++;
    return route.fulfill({ json: { ...user, role: "auctioneer" } });
  });
  await login(page);
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "SELLER STUDIO" })
    .click();
  const beforeReload = profiles;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "YOUR COLLECTION" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/seller$/);
  expect(profiles).toBeGreaterThan(beforeReload);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
  await page.getByRole("button", { name: "SIGN OUT", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "SIGN OUT", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "SIGN OUT", exact: true }),
  ).toHaveCount(0);
});
test("server rejection during restore clears stored credentials", async ({
  page,
}) => {
  await setup(page);
  await login(page);
  await page.route(`**/api/users/${user.id}`, (route) =>
    route.fulfill({ status: 401, json: { message: "Unauthorized" } }),
  );
  await page.reload();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("status")).toContainText("session expired");
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
});
test("temporary restore failure keeps the token and supports retry", async ({
  page,
}) => {
  await setup(page);
  await login(page);
  let fail = true;
  await page.route(`**/api/users/${user.id}`, (route) =>
    route.fulfill(
      fail ? { status: 503, json: { message: "Unavailable" } } : { json: user },
    ),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Could not restore");
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
  fail = false;
  await page.getByRole("button", { name: "RETRY", exact: true }).click();
  await expect(page.locator(".hs-wallet-grid")).toBeVisible();
});
test("removes legacy storage tokens and restores using the refresh cookie", async ({
  page,
}) => {
  await setup(page);
  await login(page);
  await page.evaluate(
    (key) => sessionStorage.setItem(key, "legacy-token"),
    key,
  );
  await page.reload();
  await expect(page.locator(".hs-wallet-grid")).toBeVisible();
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
});

test("renews before access-token expiry without logging out", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install();
  await login(page);
  const renewed =
    "x." +
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".x";
  await page.route("**/api/wallet", (route) =>
    route.fulfill({
      json: {
        walletId: "wallet1",
        currency: "USD",
        total: "100.00",
        committed: "0.00",
        available: "100.00",
      },
    }),
  );
  let rotations = 0;
  await page.route("**/api/auth/refresh", (route) => {
    rotations++;
    return route.fulfill({ json: { accessToken: renewed } });
  });
  await page.clock.fastForward(850000);
  await expect.poll(() => rotations).toBe(1);
  await expect(
    page.getByRole("button", { name: "SIGN OUT", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".hs-wallet-grid")).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain(renewed);
});

test("expired refresh token requires login", async ({ page }) => {
  await setup(page);
  await page.clock.install();
  await login(page);
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "Refresh session expired" },
    }),
  );
  await page.clock.fastForward(850000);
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("status")).toContainText("session expired");
});

test("concurrent unauthorized requests share one refresh and retry with the new token", async ({
  page,
}) => {
  await setup(page, { role: "auctioneer" });
  await login(page);
  const renewed =
    "x." +
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".x";
  let rotations = 0;
  await page.route("**/api/auth/refresh", async (route) => {
    rotations++;
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ json: { accessToken: renewed } });
  });
  await page.route("**/api/me/auction-summary", (route) =>
    route.fulfill(
      route.request().headers().authorization === `Bearer ${renewed}`
        ? {
            json: {
              lots: 0,
              live: 0,
              sold: 0,
              currency: "USD",
              totalReceived: "0.00",
            },
          }
        : { status: 401, json: { message: "Expired" } },
    ),
  );
  await page.route("**/api/lots/mine?**", (route) =>
    route.fulfill(
      route.request().headers().authorization === `Bearer ${renewed}`
        ? { json: { items: [], total: 0, page: 1, limit: 9 } }
        : { status: 401, json: { message: "Expired" } },
    ),
  );
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "SELLER STUDIO" })
    .click();
  await expect(page.getByText("No lots yet.", { exact: false })).toBeVisible();
  expect(rotations).toBe(1);
});
