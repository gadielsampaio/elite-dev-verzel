import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { setup, lot, token } from "./support/api";
const url = `/#/lot/${lot.id}`;
const settled = {
  lotId: lot.id,
  title: lot.title,
  currency: "USD",
  endTime: lot.endTime,
  status: "settled",
  items: lot.items,
  receipt: {
    id: "receipt",
    amount: "105.00",
    winnerAlias: "private-me",
    winningBidId: "bid1",
    endedAt: lot.endTime,
    settledAt: lot.endTime,
  },
};
async function fixture(page: Page, { role = "bidder" } = {}) {
  await setup(page, { role });
  const startedAt = Date.now();
  const state = {
    status: "open",
    endTime: lot.endTime,
    serverTime: "2027-01-01T18:30:00Z",
    bestBid: null as unknown,
    leading: false,
    result: { ...settled },
    failure: "",
    attempts: [] as { amount: string; idempotencyKey: string }[],
    historyReads: 0,
  };
  await page.route(`**/api/lots/${lot.id}**`, async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith("/bids/me")) {
      expect(r.request().headers().authorization).toBe(`Bearer ${token}`);
      return r.fulfill({
        json: {
          bidderAlias: "private-me",
          bestBid: state.bestBid,
          isLeading: state.leading,
          position: state.bestBid ? 1 : null,
        },
      });
    }
    if (path.endsWith("/result"))
      return r.fulfill({
        json: {
          ...state.result,
          winnerAlias: state.result.receipt?.winnerAlias,
          canViewReceipt:
            state.result.status === "settled" &&
            !!r.request().headers().authorization &&
            (role === "auctioneer" ||
              state.result.receipt?.winnerAlias === "private-me"),
          receipt: null,
        },
      });
    if (path.endsWith("/bids")) {
      if (r.request().method() === "POST") {
        state.attempts.push(r.request().postDataJSON());
        if (state.failure === "network") {
          state.failure = "";
          return r.abort();
        }
        if (state.failure === "balance")
          return r.fulfill({
            status: 409,
            json: { message: "Insufficient available balance" },
          });
        state.bestBid = { amount: "105.00" };
        state.leading = true;
        return r.fulfill({ status: 201, json: { id: "new-bid" } });
      }
      state.historyReads++;
      return r.fulfill({
        json: {
          lotId: lot.id,
          status: state.status,
          serverTime: new Date(
            Date.parse(state.serverTime) + Date.now() - startedAt,
          ).toISOString(),
          endTime: state.endTime,
          currentBid: "100.00",
          minimumNextBid: "105.00",
          currency: "USD",
          startingBid: "100.00",
          items: [
            {
              id: "bid1",
              bidderAlias: "private-me",
              bidderLabel: "Bidder A",
              amount: "100.00",
              createdAt: state.serverTime,
              isActive: true,
            },
            {
              id: "bid2",
              bidderAlias: "private-other",
              bidderLabel: "Bidder B",
              amount: "95.00",
              createdAt: state.serverTime,
              isActive: true,
            },
          ],
          total: 2,
          page: 1,
          limit: 20,
        },
      });
    }
    return r.fulfill({
      json: { ...lot, status: state.status, endTime: state.endTime },
    });
  });
  return state;
}
async function login(page: Page) {
  await page.getByLabel("EMAIL ADDRESS").fill("bidder@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#shadcn-login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#/lot/${lot.id}$`));
}
async function enter(page: Page) {
  await page.goto(url);
  await page.getByRole("link", { name: "Login", exact: true }).click();
  await login(page);
  await expect(page).toHaveURL(new RegExp(`#/lot/${lot.id}$`));
}
test("guest login returns to the same lot; tabs anonymize history and mobile fits", async ({
  page,
}) => {
  await fixture(page);
  await page.goto(url);
  await expect(
    page.getByRole("tab", { name: "Bid", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Verify history" })).toHaveCount(
    0,
  );
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.getByText("Bidder A", { exact: true })).toBeVisible();
  await expect(page.getByText("private-me", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Artwork details", exact: true }).click();
  await expect(page.getByText("Oil on canvas", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Bid", exact: true }).click();
  const loginBox = await page
    .getByRole("link", { name: "Login", exact: true })
    .boundingBox();
  await page.getByRole("link", { name: "Login", exact: true }).click();
  await login(page);
  const bidButton = page.getByRole("button", {
    name: "Place bid",
    exact: true,
  });
  await expect(bidButton).toBeVisible();
  const bidBox = await bidButton.boundingBox();
  expect(Math.abs(bidBox!.y - loginBox!.y)).toBeLessThanOrEqual(1);
  expect(bidBox!.height).toBe(loginBox!.height);

  await expect(page).toHaveURL(new RegExp(`#/lot/${lot.id}$`));
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.getByText("You", { exact: true })).toBeVisible();
  await expect(page.getByText("Bidder B", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Bid", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Place bid", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: "/tmp/new-auction-room.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Place bid", exact: true }),
  ).toBeVisible();
});
test("uncertain bid retains the same idempotency key across reload", async ({
  page,
}) => {
  const s = await fixture(page);
  await enter(page);
  await page.getByLabel("Bid amount (USD)").fill("105.00");
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await page.getByRole("tab", { name: "Bid", exact: true }).click();
  await expect(page.getByLabel("Bid amount (USD)")).toHaveValue("$105.00");
  s.failure = "network";
  await page.getByRole("button", { name: "Place bid", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry bid", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Retry bid", exact: true }).click();
  await expect(page.getByText("Bid accepted", { exact: true })).toBeVisible();
  expect(s.attempts).toHaveLength(2);
  expect(s.attempts[0]).toEqual(s.attempts[1]);
  await expect(
    page.getByText("You are currently leading", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Place bid", exact: true }),
  ).toBeDisabled();
});
test("insufficient balance offers a choice and deposit returns without auto-bidding", async ({
  page,
}) => {
  const s = await fixture(page);
  await enter(page);
  s.failure = "balance";
  await page.getByLabel("Bid amount (USD)").fill("105.00");
  await page.getByRole("button", { name: "Place bid", exact: true }).click();
  const alert = page.getByRole("alertdialog", { name: "Insufficient available balance" });
  await expect(alert).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/lot/${lot.id}$`));
  await alert.getByRole("button", { name: "Not now" }).click();
  await expect(alert).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#/lot/${lot.id}$`));
  await expect(page.getByLabel("Bid amount (USD)")).toHaveValue("$105.00");
  expect(s.attempts).toHaveLength(1);
  await page.getByRole("button", { name: "Place bid", exact: true }).click();
  await alert.getByRole("button", { name: "Add funds", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/wallet\\?lot=${lot.id}$`));
  await expect(
    page.getByRole("link", { name: "Return to lot", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Deposit amount (USD)").fill("50.00");
  await page
    .getByRole("button", { name: "Simulate deposit", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#/lot/${lot.id}$`));
  await expect(
    page.getByRole("button", { name: "Place bid", exact: true }),
  ).toBeEnabled();
  expect(s.attempts).toHaveLength(2);
});
for (const winner of [true, false])
  test(`confirmed closure shows ${winner ? "winner" : "loser"} and removes all bid controls`, async ({
    page,
  }) => {
    const s = await fixture(page);
    await enter(page);
    s.status = "closed";
    s.bestBid = { amount: "100.00" };
    s.leading = true;
    if (!winner)
      s.result = {
        ...settled,
        receipt: { ...settled.receipt, winnerAlias: "private-other" },
      };
    await page
      .getByRole("button", { name: "Refresh lot", exact: true })
      .click();
    await expect(
      page.getByText(
        winner
          ? "You won this auction. Settlement is complete."
          : "You did not win this auction. Settlement is complete.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Settlement is complete." }),
    ).toHaveCSS("color", winner ? "rgb(54, 98, 71)" : "rgb(158, 52, 40)");
    await expect(
      page.getByRole("link", { name: "Result / Receipt", exact: true }),
    ).toHaveCount(winner ? 1 : 0);
    await expect(page.getByLabel("Bid amount (USD)")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /place bid|retry bid/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Verify history", exact: true }),
    ).toHaveAttribute("href", `/#/audit/${lot.id}`);
  });
test("pending settlement never claims a winner and non-bidders cannot bid", async ({
  page,
}) => {
  const s = await fixture(page, { role: "auctioneer" });
  await enter(page);
  await expect(
    page.getByText("Only bidder accounts can place bids."),
  ).toBeVisible();
  s.status = "closed";
  s.result = {
    ...settled,
    status: "pending_settlement",
    receipt: null as never,
  };
  await page.getByRole("button", { name: "Refresh lot", exact: true }).click();
  await expect(
    page.getByText(
      "Bidding has ended. The final result is awaiting confirmation.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(/You won this auction/)).toHaveCount(0);
  expect(s.attempts).toHaveLength(0);
});
test("deadline hides bid controls even before server closure is confirmed", async ({
  page,
}) => {
  const s = await fixture(page);
  s.endTime = "2027-01-01T18:30:03Z";
  await enter(page);
  await expect(page.getByLabel("Bid amount (USD)")).toHaveCount(0, {
    timeout: 10000,
  });
  await expect(page.getByText("Bidding ended", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Verify history" })).toHaveCount(
    0,
  );
});
test("live closure and settlement update the room without a manual refresh", async ({
  page,
}) => {
  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket("**/api/socket.io/**", (ws) => {
    sockets.push(ws);
    ws.send(
      "0" +
        JSON.stringify({
          sid: "room",
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
        }),
    );
    ws.onMessage((message) => {
      const text = String(message);
      if (text === "40/auctions,") ws.send('40/auctions,{"sid":"room"}');
      const ack = text.match(/^42\/auctions,(\d+)\[/);
      if (ack) ws.send(`43/auctions,${ack[1]}[{"ok":true}]`);
    });
  });
  const s = await fixture(page);
  await enter(page);
  await expect(
    page.getByText("Live updates connected", { exact: true }),
  ).toBeVisible();
  s.status = "closed";
  s.bestBid = { amount: "105.00" };
  sockets.forEach((ws) =>
    ws.send(`42/auctions,["collection.changed",{"lotId":"${lot.id}"}]`),
  );
  await expect(
    page.getByText("You won this auction. Settlement is complete.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Bid amount (USD)")).toHaveCount(0);
});
