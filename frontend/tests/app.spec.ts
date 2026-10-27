import { test, expect, type Page } from "@playwright/test";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test Bidder",
  role: "bidder",
};
const token =
  "x." +
  Buffer.from(JSON.stringify({ sub: user.id })).toString("base64url") +
  ".x";
const lot = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Sunday afternoon",
  status: "scheduled",
  currency: "USD",
  startingBid: "100.00",
  bidIncrement: "5.00",
  startTime: "2027-01-01T18:00:00Z",
  endTime: "2027-01-01T19:00:00Z",
  items: [
    {
      id: "item1",
      name: "Painting",
      imageUrl: null,
      artistDisplay: "Georges Seurat",
      sourceSnapshot: { provider: "mock", mediumDisplay: "Oil on canvas" },
    },
  ],
};
async function setup(
  page: Page,
  { failFirst = false, role = "bidder", failBalanceAfterDeposit = false } = {},
) {
  const deposits: { amount: string; idempotencyKey: string }[] = [];
  let deposited = false;
  let filters: string[] = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    let body: unknown;
    let status = 200;
    if (url.pathname === "/api/auth/login") body = { accessToken: token };
    else if (url.pathname === "/api/auth/register") {
      body = user;
      status = 201;
    } else if (url.pathname === `/api/users/${user.id}`)
      body = { ...user, role };
    else if (url.pathname === "/api/lots") {
      filters.push(url.searchParams.get("status") ?? "");
      body = { items: [lot], page: 1, limit: 9, total: 1 };
    } else if (url.pathname === `/api/lots/${lot.id}`) body = lot;
    else if (url.pathname === "/api/wallet") {
      expect(req.headers().authorization).toBe(`Bearer ${token}`);
      if (deposited && failBalanceAfterDeposit) {
        status = 503;
        body = { message: "Unavailable" };
      } else
        body = {
          walletId: "wallet1",
          currency: "USD",
          total: deposited ? "150.00" : "100.00",
          committed: "20.00",
          available: deposited ? "130.00" : "80.00",
        };
    } else if (url.pathname === "/api/wallet/deposits") {
      expect(req.headers().authorization).toBe(`Bearer ${token}`);
      deposits.push(req.postDataJSON());
      if (failFirst && deposits.length === 1) {
        await route.abort();
        return;
      }
      deposited = true;
      status = 201;
      body = { id: "deposit1", amount: "50.00" };
    } else {
      status = 404;
      body = { message: "Not found" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return { deposits, filters };
}
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("bidder@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("USD 80.00")).toBeVisible();
}

test("browses status filters and saved lot details", async ({ page }) => {
  const { filters } = await setup(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Live", exact: true }).click();
  await expect.poll(() => filters.includes("open")).toBe(true);
  await page.getByRole("link", { name: /Sunday afternoon/ }).click();
  await expect(
    page.getByRole("heading", { name: "Sunday afternoon" }),
  ).toBeVisible();
  await expect(page.getByText("Oil on canvas")).toBeVisible();
  await expect(page.getByText("Bidding is not available yet.")).toBeVisible();
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
  await expect(page.getByLabel("Amount (USD)")).toHaveValue("50.00");
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
