import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { setup, lot } from "./support/api";

async function feed(page: Page) {
  const sockets = new Set<WebSocketRoute>();
  await page.routeWebSocket("**/api/socket.io/**", (ws) => {
    sockets.add(ws);
    ws.onClose(() => sockets.delete(ws));
    ws.send(
      "0" +
        JSON.stringify({
          sid: "updates",
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
        }),
    );
    ws.onMessage((message) => {
      const text = message.toString();
      if (text === "40/auctions,") ws.send('40/auctions,{"sid":"updates"}');
      const ack = text.match(/^42\/auctions,(\d+)\[/);
      if (ack) ws.send(`43/auctions,${ack[1]}[{"ok":true}]`);
    });
  });
  return (event: string, body: unknown = {}) =>
    sockets.forEach((ws) =>
      ws.send("42/auctions," + JSON.stringify([event, body])),
    );
}
async function login(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("seller@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#shadcn-login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}

test("storefront loads initially, retains filters and updates from events without connected polling", async ({
  page,
}) => {
  await setup(page);
  const signal = await feed(page);
  let title = "Initial collection";
  const requests: string[] = [];
  await page.route("**/api/lots?**", (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      json: { items: [{ ...lot, title }], total: 20, page: 1, limit: 9 },
    });
  });
  await page.goto("/#/");
  await expect(
    page.getByRole("link", { name: "View Initial collection", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "UPCOMING" }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect
    .poll(() =>
      requests.some(
        (r) => r.includes("page=2") && r.includes("status=scheduled"),
      ),
    )
    .toBe(true);
  title = "Changed collection";
  signal("collection.changed", { lotId: lot.id, type: "lot.created" });
  await expect(
    page.getByRole("link", { name: "View Changed collection", exact: true }),
  ).toBeVisible();
  expect(requests.filter((r) => r.includes("limit=9")).at(-1)).toContain(
    "status=scheduled",
  );
  expect(requests.filter((r) => r.includes("limit=9")).at(-1)).toContain(
    "page=2",
  );
  await page.clock.install();
  const count = requests.length;
  await page.clock.fastForward(12000);
  expect(requests).toHaveLength(count);
});

test("seller summary, owned lots and wallet update without manual refresh", async ({
  page,
}) => {
  await setup(page, { role: "auctioneer" });
  const signal = await feed(page);
  let total = "0.00",
    title = "Owned collection";
  await page.route("**/api/me/auction-summary", (route) =>
    route.fulfill({
      json: {
        lots: 1,
        live: 1,
        sold: 0,
        currency: "USD",
        totalReceived: total,
      },
    }),
  );
  await page.route("**/api/lots/mine?**", (route) =>
    route.fulfill({
      json: {
        items: [{ ...lot, title, bidCount: 0, canCancel: false }],
        total: 1,
        page: 1,
        limit: 9,
      },
    }),
  );
  await login(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "SELLER STUDIO" })
    .click();
  await expect(
    page
      .getByRole("link", {
        name: /View lot (Owned collection|Updated owned lot)/,
      })
      .locator(".."),
  ).toContainText("Owned collection");
  await expect(page.getByText("$0.00", { exact: true })).toBeVisible();
  total = "125.00";
  title = "Updated owned lot";
  signal("collection.changed", { lotId: lot.id, type: "lot.settled" });
  await expect(page.getByText("$125.00", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("link", {
        name: /View lot (Owned collection|Updated owned lot)/,
      })
      .locator(".."),
  ).toContainText("Updated owned lot");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "WALLET" })
    .click();
  await expect(page.getByText("$100.00", { exact: true })).toBeVisible();
  await page.route("**/api/wallet", (route) =>
    route.fulfill({
      json: {
        walletId: "wallet1",
        currency: "USD",
        total: "250.00",
        committed: "0.00",
        available: "250.00",
      },
    }),
  );
  signal("account.changed");
  await expect(
    page.getByText("$250.00", { exact: true }).first(),
  ).toBeVisible();
});

test("initial HTTP load and fallback work even when WebSocket never connects", async ({
  page,
}) => {
  await setup(page);
  await page.routeWebSocket("**/api/socket.io/**", () => {});
  await page.clock.install();
  let title = "Initial offline collection";
  await page.route("**/api/lots?**", (route) =>
    route.fulfill({
      json: { items: [{ ...lot, title }], total: 1, page: 1, limit: 9 },
    }),
  );
  await page.goto("/#/");
  await expect(
    page.getByRole("link", {
      name: "View Initial offline collection",
      exact: true,
    }),
  ).toBeVisible();
  title = "Fallback collection";
  await page.clock.fastForward(10200);
  await expect(
    page.getByRole("link", { name: "View Fallback collection", exact: true }),
  ).toBeVisible();
});
