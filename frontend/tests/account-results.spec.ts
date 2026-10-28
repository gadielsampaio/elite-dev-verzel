import { test, expect, type Page } from "@playwright/test";
import { setup, lot, token } from "./support/api";

async function login(page: Page, role: string) {
  await setup(page, { role });
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("account@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(page.locator(".hs-wallet-grid")).toBeVisible();
}
const result = {
  lotId: lot.id,
  title: "Settled artwork",
  currency: "USD",
  status: "closed",
  outcome: "settled",
  amount: "9007199254740993.01",
  endTime: lot.endTime,
  settledAt: lot.endTime,
  receiptPath: `/#/receipt/${lot.id}`,
  items: [],
  won: true,
  myBestBid: "9007199254740993.01",
};

test("seller sees actual totals and distinct settled, pending and empty-lot outcomes", async ({
  page,
}) => {
  await login(page, "auctioneer");
  await page.route("**/api/me/auction-summary", (route) =>
    route.fulfill({
      json: {
        lots: 3,
        live: 0,
        sold: 1,
        totalReceived: result.amount,
        currency: "USD",
      },
    }),
  );
  await page.route("**/api/me/auction-results?**", (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    return route.fulfill({
      json: {
        total: 3,
        page: 1,
        limit: 9,
        items: [
          result,
          {
            ...result,
            lotId: "pending",
            title: "Waiting artwork",
            outcome: "pending_settlement",
            amount: null,
            receiptPath: null,
          },
          {
            ...result,
            lotId: "empty",
            title: "Unsold artwork",
            outcome: "no_winner",
            amount: null,
            receiptPath: null,
          },
        ],
      },
    });
  });
  await page.evaluate(() => {
    location.hash = "/seller";
  });
  await expect(page.locator(".hs-seller-stats")).toContainText(
    "$9,007,199,254,740,993.01",
  );
  await page.getByRole("tab", { name: "RESULTS", exact: true }).click();
  await expect(page.getByText("SOLD · SETTLED", { exact: true })).toBeVisible();
  await expect(page.getByText("SETTLEMENT PENDING")).toBeVisible();
  await expect(page.getByText("CLOSED WITHOUT A WINNER")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "VIEW / SHARE RECEIPT ↗" }),
  ).toHaveCount(1);
});

test("bidder participation and wins preserve filters across pagination and expose receipt links", async ({
  page,
}) => {
  await login(page, "bidder");
  const requests: URL[] = [];
  await page.route("**/api/me/participations?**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    return route.fulfill({
      json: {
        total: 10,
        page: Number(url.searchParams.get("page")),
        limit: 9,
        items: [result],
      },
    });
  });
  await page.getByRole("button", { name: "MY BIDS", exact: true }).click();
  await expect(page.getByText("WON · SETTLED")).toBeVisible();
  await page.getByRole("tab", { name: "MY WINS", exact: true }).click();
  await page.getByRole("button", { name: "NEXT RESULTS" }).click();
  await expect.poll(() => requests.at(-1)?.searchParams.get("page")).toBe("2");
  expect(requests.at(-1)?.searchParams.get("filter")).toBe("wins");
  await expect(
    page.getByRole("link", { name: "VIEW / SHARE RECEIPT ↗" }),
  ).toHaveAttribute("href", result.receiptPath);
  await page.screenshot({ path: "/tmp/haus-wins-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/haus-wins-mobile.png", fullPage: true });
});

test("account results show failure/retry and empty states without inventing wins", async ({
  page,
}) => {
  await login(page, "bidder");
  let failed = true;
  await page.route("**/api/me/participations?**", (route) =>
    route.fulfill(
      failed
        ? { status: 503, json: { message: "Results unavailable" } }
        : { json: { items: [], total: 0, page: 1, limit: 9 } },
    ),
  );
  await page.evaluate(() => {
    location.hash = "/activity";
  });
  await expect(page.getByRole("alert")).toHaveText("Results unavailable");
  failed = false;
  await page.getByRole("button", { name: "REFRESH RESULTS" }).click();
  await expect(page.getByText("No participation yet.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "VIEW / SHARE RECEIPT ↗" }),
  ).toHaveCount(0);
});
