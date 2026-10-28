import { test, expect, type WebSocketRoute } from "@playwright/test";
import { setup, lot } from "./support/api";

test("room follows lifecycle signals, confirms settlement and clears cancelled data", async ({
  page,
}) => {
  await setup(page);
  let socket: WebSocketRoute;
  await page.routeWebSocket("**/api/socket.io/**", (ws) => {
    socket = ws;
    ws.send(
      "0" +
        JSON.stringify({
          sid: "test",
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
        }),
    );
    ws.onMessage((message) => {
      const text = message.toString();
      if (text === "40/auctions,") ws.send('40/auctions,{"sid":"test"}');
      const ack = text.match(/^42\/auctions,(\d+)\[/);
      if (ack)
        ws.send(
          `43/auctions,${ack[1]}${JSON.stringify([{ ok: true, lotId: lot.id }])}`,
        );
    });
  });
  let status = "scheduled",
    settled = false,
    cancelled = false;
  const signal = (type: string) =>
    socket.send(
      "42/auctions," +
        JSON.stringify([
          "lot.changed",
          { type, lotId: lot.id, endTime: lot.endTime },
        ]),
    );
  await page.route(`**/api/lots/${lot.id}**`, (route) => {
    if (cancelled)
      return route.fulfill({ status: 404, json: { message: "Lot not found" } });
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/result"))
      return route.fulfill({
        json: {
          status: settled ? "settled" : "pending_settlement",
          receipt: settled ? { id: "receipt" } : null,
        },
      });
    if (path.endsWith("/bids"))
      return route.fulfill({
        json: {
          ...lot,
          lotId: lot.id,
          status,
          serverTime: new Date().toISOString(),
          items: [],
          total: 0,
          page: 1,
          limit: 20,
          currentBid: null,
          minimumNextBid: "100.00",
        },
      });
    return route.fulfill({ json: { ...lot, status } });
  });
  await page.goto("/#/");
  await page
    .getByRole("button", { name: `View ${lot.title}`, exact: true })
    .click();
  await expect(
    page.getByText("LIVE UPDATES CONNECTED", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".hs-p-topline")).toHaveText("SCHEDULED");
  status = "open";
  signal("lot.opened");
  await expect(page.locator(".hs-p-topline")).toHaveText("● LIVE NOW");
  status = "closed";
  signal("lot.closed");
  await expect(
    page.getByText("BIDDING CLOSED — SETTLEMENT PENDING.", { exact: false }),
  ).toBeVisible();
  settled = true;
  signal("lot.settled");
  await expect(
    page.getByText("SETTLED — RECEIPT AVAILABLE.", { exact: false }),
  ).toBeVisible();
  // Separate eligible cancellation path; no settlement is inferred from this signal.
  cancelled = true;
  signal("lot.cancelled");
  await expect(
    page.getByText("LOT UNAVAILABLE", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("SETTLED — RECEIPT AVAILABLE.", { exact: false }),
  ).toHaveCount(0);
});
