import { test, expect, type Page } from "@playwright/test";
import { setup, lot, token, user } from "./support/api";
async function signIn(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("bidder@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(page.locator(".hs-wallet-grid")).toBeVisible();
}
test("application has real empty/error states and never substitutes prototype lots", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/lots?**", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { message: "Database unavailable" } }
        : { json: { items: [], page: 1, limit: 9, total: 0 } },
    ),
  );
  await page.goto("/");
  await expect(page.getByRole("alert").first()).toContainText(
    "Database unavailable",
  );
  await expect(page.getByText("Self-Portrait", { exact: true })).toHaveCount(0);
  await expect(page.getByText("DEMO / COLLECTOR")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "REFRESH LOTS" }).click();
  await expect(page.getByText("NO LOTS FOUND", { exact: true })).toBeVisible();
  await expect(page.getByText("COMING SOON", { exact: true })).toBeVisible();
});
test("published lots use server filters/pagination and saved details while museum is offline", async ({
  page,
}) => {
  const requests: string[] = [];
  const published = {
    ...lot,
    title: "Saved collection",
    startingBid: "9007199254740993.01",
    items: [{ ...lot.items[0], imageUrl: null }],
  };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    if (url.pathname === "/api/lots")
      await route.fulfill({
        json: {
          items: url.searchParams.get("status") === "open" ? [] : [published],
          total: 10,
          page: Number(url.searchParams.get("page")),
          limit: 9,
        },
      });
    else if (url.pathname.endsWith("/bids"))
      await route.fulfill({
        json: {
          lotId: lot.id,
          status: "closed",
          currency: "USD",
          startingBid: published.startingBid,
          currentBid: "9007199254740994.09",
          minimumNextBid: null,
          serverTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          items: [
            {
              id: "bid1",
              bidderAlias: "bidder_public_alias",
              bidderLabel: "Bidder A",
              amount: "9007199254740994.09",
              createdAt: new Date().toISOString(),
              isActive: true,
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
        },
      });
    else await route.fulfill({ json: published });
  });
  let museumRequests = 0;
  await page.route("https://openaccess-api.clevelandart.org/**", (route) => {
    museumRequests++;
    return route.abort();
  });
  await page.goto("/");
  await expect(page.getByText("$9,007,199,254,740,993.01")).toBeVisible();
  await page.getByRole("tab", { name: "UPCOMING", exact: true }).click();
  await expect
    .poll(() => requests.some((r) => r.includes("status=scheduled")))
    .toBe(true);
  await page.getByRole("button", { name: "NEXT →" }).click();
  await expect
    .poll(() => requests.some((r) => r.includes("page=2")))
    .toBe(true);
  await page
    .getByRole("button", { name: "View Saved collection", exact: true })
    .click();
  const room = page.getByRole("dialog");
  await expect(room.getByText("Bidder A")).toBeVisible();
  await expect(
    room.getByText("$9,007,199,254,740,994.09").first(),
  ).toBeVisible();
  await expect(room.getByText("LAST BID", { exact: true })).toBeVisible();
  await expect(room.getByRole("button", { name: /PLACE.*BID/ })).toHaveCount(0);
  await room.getByRole("button", { name: "ARTWORK DETAILS" }).click();
  await expect(room.getByText("Oil on canvas")).toBeVisible();
  expect(museumRequests).toBe(0);
});
test("registers the selected role and establishes an in-memory session", async ({
  page,
}) => {
  await setup(page, { role: "auctioneer" });
  let body: unknown;
  await page.route("**/api/auth/register", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: { ...user, role: "auctioneer" },
    });
  });
  await page.goto("/#/register");
  await page.getByLabel("FULL NAME").fill("Test Auctioneer");
  await page.getByLabel("EMAIL ADDRESS").fill("seller@example.com");
  await page.getByRole("radio", { name: /AUCTIONEER/ }).check();
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page.getByLabel("CONFIRM PASSWORD").fill("test-password-123");
  await page
    .getByRole("button", { name: "CREATE ACCOUNT", exact: true })
    .click();
  await expect(
    page.getByText("Deposits are available to bidder accounts only."),
  ).toBeVisible();
  expect(body).toEqual({
    name: "Test Auctioneer",
    email: "seller@example.com",
    password: "test-password-123",
    role: "auctioneer",
  });
  await expect(page.getByRole("button", { name: "SIGN OUT" })).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain(token);
  await page.reload();
  await expect(page).toHaveURL(/#\/login$/);
});
test("registration validation, conflict feedback and partial login failure do not resubmit registration", async ({
  page,
}) => {
  await setup(page);
  let registrations = 0,
    conflict = true;
  await page.route("**/api/auth/register", (route) => {
    registrations++;
    return route.fulfill(
      conflict
        ? { status: 409, json: { message: "Email already exists" } }
        : { status: 201, json: user },
    );
  });
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 503, json: { message: "Login unavailable" } }),
  );
  await page.goto("/#/register");
  await page.getByLabel("FULL NAME").fill("Test Bidder");
  await page.getByLabel("EMAIL ADDRESS").fill("bidder@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("é".repeat(37));
  await page.getByLabel("CONFIRM PASSWORD").fill("é".repeat(37));
  await page
    .getByRole("button", { name: "CREATE ACCOUNT", exact: true })
    .click();
  await expect(
    page.getByText("Password must be at most 72 UTF-8 bytes."),
  ).toBeVisible();
  expect(registrations).toBe(0);
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page.getByLabel("CONFIRM PASSWORD").fill("test-password-123");
  await page
    .getByRole("button", { name: "CREATE ACCOUNT", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Email already exists");
  conflict = false;
  await page
    .getByRole("button", { name: "CREATE ACCOUNT", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("status")).toContainText(
    "Account created. Please log in",
  );
  expect(registrations).toBe(2);
});
test("wallet retains a deposit key across navigation and sends decimal strings", async ({
  page,
}) => {
  const { deposits } = await setup(page, { failFirst: true });
  await signIn(page);
  await expect(page.locator(".hs-wallet-grid strong").nth(1)).toHaveText(
    "$20.00",
  );
  await expect(page.locator(".hs-wallet-grid strong").nth(2)).toHaveText(
    "$80.00",
  );
  await page.getByLabel("DEPOSIT AMOUNT (USD)").fill("50.00");
  await page
    .getByRole("button", { name: "SIMULATE DEPOSIT", exact: false })
    .click();
  await expect(page.getByRole("alert")).toContainText("Cannot reach");
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "AUCTIONS" })
    .click();
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "WALLET" })
    .click();
  await expect(page.getByLabel("DEPOSIT AMOUNT (USD)")).toHaveValue("$50.00");
  await page
    .getByRole("button", { name: "RETRY DEPOSIT", exact: false })
    .click();
  await expect(page.locator(".hs-wallet-grid strong").last()).toHaveText(
    "$130.00",
  );
  expect(deposits).toHaveLength(2);
  expect(deposits[0]).toEqual(deposits[1]);
  expect(deposits[0].amount).toBe("50.00");
});
test("successful deposit with failed refresh does not re-credit; expired JWT clears session", async ({
  page,
}) => {
  const { deposits } = await setup(page, { failBalanceAfterDeposit: true });
  await signIn(page);
  await page.getByLabel("DEPOSIT AMOUNT (USD)").fill("50.00");
  await page
    .getByRole("button", { name: "SIMULATE DEPOSIT", exact: false })
    .click();
  await expect(page.getByRole("alert")).toContainText("Deposit recorded");
  await page.getByRole("button", { name: "REFRESH BALANCE" }).click();
  expect(deposits).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "RETRY DEPOSIT", exact: false }),
  ).toHaveCount(0);
  await page.route("**/api/wallet", (route) =>
    route.fulfill({ status: 401, json: { message: "Unauthorized" } }),
  );
  await page.getByRole("button", { name: "REFRESH BALANCE" }).click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("status")).toContainText("session expired");
});
test("mobile auth and wallet remain usable; unauthenticated wallet is protected", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/wallet");
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.locator("#login-form")).toBeVisible();
  await signIn(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "SIGN OUT" }).click();
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "WALLET" })
    .click();
  await expect(page).toHaveURL(/#\/login$/);
});
