import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { setup, lot, token } from "./support/api";
const result = {
  lotId: lot.id,
  title: "Museum artwork",
  currency: "USD",
  status: "closed",
  outcome: "settled",
  endTime: lot.endTime,
  settledAt: lot.endTime,
  amount: "9007199254740993.01",
  myBestBid: "9007199254740993.01",
  won: true,
  receiptPath: `/#/receipt/${lot.id}`,
  items: [],
};
async function login(page: Page, role = "bidder") {
  await setup(page, { role });
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("bidder@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#shadcn-login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}
test("participation shows exact bids and distinguishes pending, won and not won", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/me/participations?**", (r) => {
    expect(r.request().headers().authorization).toBe(`Bearer ${token}`);
    return r.fulfill({
      json: {
        page: 1,
        total: 3,
        limit: 9,
        items: [
          result,
          {
            ...result,
            lotId: "pending",
            title: "Awaiting auction",
            outcome: "pending_settlement",
            won: false,
            settledAt: null,
            amount: null,
            receiptPath: null,
          },
          {
            ...result,
            lotId: "lost",
            title: "Another auction",
            won: false,
            receiptPath: null,
          },
        ],
      },
    });
  });
  await page
    .locator("header")
    .getByRole("link", { name: "MY BIDS", exact: true })
    .click();
  await expect(page).toHaveURL(/\/#\/activity$/);
  await expect(page.getByText("Won · Settled", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Not won · Settled", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Settlement pending", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("$9,007,199,254,740,993.01", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Result/Receipt", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Result/Receipt", exact: true }),
  ).toHaveAttribute("href", `/#/receipt/${result.lotId}`);
  await expect(
    page.getByRole("link", { name: "View lot Museum artwork", exact: true }),
  ).toHaveAttribute("href", `/#/lot/${lot.id}`);
  await page.screenshot({ path: "/tmp/my-bids-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("wins filter is sent to server, persists through pagination and resets page", async ({
  page,
}) => {
  await login(page);
  const requests: URL[] = [];
  await page.route("**/api/me/participations?**", (r) => {
    const u = new URL(r.request().url());
    requests.push(u);
    return r.fulfill({
      json: {
        page: Number(u.searchParams.get("page")),
        total: 18,
        limit: 9,
        items: [result],
      },
    });
  });
  await page.goto("/#/activity");
  await page.getByRole("tab", { name: "My wins", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Result/Receipt", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect.poll(() => requests.at(-1)?.searchParams.get("page")).toBe("2");
  expect(requests.at(-1)?.searchParams.get("filter")).toBe("wins");
  await page
    .getByRole("tab", { name: "All participation", exact: true })
    .click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("filter"))
    .toBe("all");
  expect(requests.at(-1)?.searchParams.get("page")).toBe("1");
});
test("errors can be refreshed and empty states stay honest", async ({
  page,
}) => {
  await login(page);
  let failing = true;
  await page.route("**/api/me/participations?**", (r) =>
    r.fulfill(
      failing
        ? { status: 503, json: { message: "Results unavailable" } }
        : { json: { page: 1, total: 0, limit: 9, items: [] } },
    ),
  );
  await page.goto("/#/activity");
  await expect(page.getByRole("alert")).toContainText("Results unavailable");
  failing = false;
  await page.getByRole("button", { name: "Refresh bids", exact: true }).click();
  await expect(
    page.getByText("You haven’t placed any bids yet."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "My wins", exact: true }).click();
  await expect(page.getByText("No confirmed wins yet.")).toBeVisible();
});
test("guest and auctioneer cannot fetch bidder participation", async ({
  page,
}) => {
  await login(page, "auctioneer");
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/me/participations")) calls++;
  });
  await page.goto("/#/activity");
  await expect(page.getByRole("alert")).toContainText(
    "A bidder account is required",
  );
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/#/activity");
  await expect(page.getByRole("alert")).toContainText("Sign in as a bidder");
  expect(calls).toBe(0);
});
test("settlement event updates results and makes the receipt available", async ({
  page,
}) => {
  const sockets = new Set<WebSocketRoute>();
  let settled = false;
  await page.routeWebSocket("**/api/socket.io/**", (ws) => {
    sockets.add(ws);
    ws.onClose(() => sockets.delete(ws));
    ws.send(
      "0" +
        JSON.stringify({
          sid: "bids",
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
        }),
    );
    ws.onMessage((message) => {
      const text = message.toString();
      if (text === "40/auctions,") ws.send('40/auctions,{"sid":"bids"}');
      const ack = text.match(/^42\/auctions,(\d+)\[/);
      if (ack) ws.send(`43/auctions,${ack[1]}[{"ok":true}]`);
    });
  });
  await login(page);
  await page.route("**/api/me/participations?**", (r) =>
    r.fulfill({
      json: {
        page: 1,
        total: 1,
        limit: 9,
        items: [
          settled
            ? result
            : {
                ...result,
                outcome: "pending_settlement",
                won: false,
                amount: null,
                settledAt: null,
                receiptPath: null,
              },
        ],
      },
    }),
  );
  await page.goto("/#/activity");
  await expect(
    page.getByText("Settlement pending", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Result/Receipt", exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => sockets.size).toBeGreaterThan(0);
  settled = true;
  sockets.forEach((ws) => ws.send('42/auctions,["account.changed",{}]'));
  await expect(page.getByText("Won · Settled", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Result/Receipt", exact: true }),
  ).toBeVisible();
});
