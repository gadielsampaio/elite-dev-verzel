import { test, expect, type Page } from "@playwright/test";
import { setup } from "./support/api";
async function openWallet(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("bidder@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#shadcn-login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page
    .locator("header")
    .getByRole("link", { name: "WALLET", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My wallet", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Wallet balances")).toContainText("$80.00");
}
test("wallet validates deposits, updates balances and remains inside the new layout", async ({
  page,
}) => {
  const mock = await setup(page);
  await openWallet(page);
  await expect(page).toHaveURL(/\/#\/wallet$/);
  await expect(
    page.getByRole("heading", { name: "Simulate a deposit", exact: true }),
  ).toHaveCount(0);
  const deposit = await page
    .getByRole("form", { name: "Simulate a deposit", exact: true })
    .boundingBox();
  expect(
    Math.abs(deposit!.x + deposit!.width / 2 - page.viewportSize()!.width / 2),
  ).toBeLessThan(2);

  await expect(page.locator('header a[aria-current="page"]')).toHaveText(
    "WALLET",
  );
  await page
    .getByRole("button", { name: "Simulate deposit", exact: true })
    .click();
  await expect(page.getByLabel("Deposit amount (USD)")).toBeFocused();
  await expect(
    page.getByText("Enter an amount greater than $0.00."),
  ).toBeVisible();
  expect(mock.deposits).toHaveLength(0);
  await page.getByLabel("Deposit amount (USD)").fill("50.00");
  await page
    .getByRole("button", { name: "Simulate deposit", exact: true })
    .click();
  await expect(page.getByText("Simulated deposit recorded.")).toBeVisible();
  const toast = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Deposit recorded" });
  await expect(toast).toHaveCSS("border-radius", "0px");
  await expect(toast).toHaveCSS("border-top-style", "solid");
  await expect(toast).toHaveCSS("border-top-width", "1px");
  await expect(toast).toHaveCSS("background-color", "rgb(245, 239, 227)");
  await expect(page.getByLabel("Wallet balances")).toContainText("$150.00");
  await expect(page.getByLabel("Wallet balances")).toContainText("$130.00");
  expect(mock.deposits).toHaveLength(1);
  expect(mock.deposits[0].amount).toBe("50.00");
  await page.screenshot({
    path: "/tmp/shadcn-wallet-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/shadcn-wallet-mobile.png",
    fullPage: true,
  });
});
test("unconfirmed deposit survives reload and reuses its idempotency key", async ({
  page,
}) => {
  const mock = await setup(page, { failFirst: true });
  await openWallet(page);
  await page.getByLabel("Deposit amount (USD)").fill("50.00");
  await page
    .getByRole("button", { name: "Simulate deposit", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry deposit", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Deposit amount (USD)")).toBeDisabled();
  await page.reload();
  await page
    .getByRole("button", { name: "Retry deposit", exact: true })
    .click();
  await expect(page.getByText("Simulated deposit recorded.")).toBeVisible();
  expect(mock.deposits).toHaveLength(2);
  expect(mock.deposits[1]).toEqual(mock.deposits[0]);
});
test("confirmed deposit with failed balance refresh is not offered as a retry", async ({
  page,
}) => {
  const mock = await setup(page, { failBalanceAfterDeposit: true });
  await openWallet(page);
  await page.getByLabel("Deposit amount (USD)").fill("50.00");
  await page
    .getByRole("button", { name: "Simulate deposit", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Deposit recorded, but the balance could not refresh",
  );
  await expect(
    page.getByRole("button", { name: "Retry deposit", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Refresh balance", exact: true })
    .click();
  expect(mock.deposits).toHaveLength(1);
});
test("auctioneer sees balances without deposit controls", async ({ page }) => {
  await setup(page, { role: "auctioneer" });
  await openWallet(page);
  await expect(
    page.getByText("Deposits are available to bidder accounts only."),
  ).toBeVisible();
  await expect(page.getByLabel("Deposit amount (USD)")).toHaveCount(0);
});
test("guest wallet requests no private balance and offers login", async ({
  page,
}) => {
  await setup(page);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/wallet") calls.push(r.url());
  });
  await page.goto("/#/wallet");
  await expect(page.getByText("Sign in to view your wallet.")).toBeVisible();
  expect(calls).toEqual([]);
});

test("account events refresh balances without a manual reload", async ({
  page,
}) => {
  await setup(page);
  const sockets = new Set<import("@playwright/test").WebSocketRoute>();
  await page.routeWebSocket("**/api/socket.io/**", (ws) => {
    sockets.add(ws);
    ws.onClose(() => sockets.delete(ws));
    ws.send(
      "0" +
        JSON.stringify({
          sid: "wallet-updates",
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
        }),
    );
    ws.onMessage((message) => {
      const text = message.toString();
      if (text === "40/auctions,")
        ws.send('40/auctions,{"sid":"wallet-updates"}');
      const ack = text.match(/^42\/auctions,(\d+)\[/);
      if (ack) ws.send(`43/auctions,${ack[1]}[{"ok":true}]`);
    });
  });
  await openWallet(page);
  await expect.poll(() => sockets.size).toBeGreaterThan(0);
  await page.route("**/api/wallet", (route) =>
    route.fulfill({
      json: {
        walletId: "wallet1",
        currency: "USD",
        total: "100.00",
        committed: "60.00",
        available: "40.00",
      },
    }),
  );
  sockets.forEach((ws) => ws.send('42/auctions,["account.changed",{}]'));
  await expect(page.getByLabel("Wallet balances")).toContainText("$40.00");
  await expect(page.getByLabel("Wallet balances")).toContainText("$60.00");
});
