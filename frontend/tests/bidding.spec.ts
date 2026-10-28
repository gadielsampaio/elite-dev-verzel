import { test, expect, type Page } from "@playwright/test";
import { setup, lot, token } from "./support/api";

async function room(
  page: Page,
  options: {
    role?: string;
    failure?: number;
    dropped?: boolean;
    leading?: boolean;
    status?: string;
  } = {},
) {
  await setup(page, { role: options.role ?? "bidder" });
  let accepted = false;
  const requests: { amount: string; idempotencyKey: string }[] = [];
  await page.route("**/api/lots/*/bids**", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
      requests.push(route.request().postDataJSON());
      if (options.dropped && requests.length === 1) return route.abort();
      if (options.failure)
        return route.fulfill({
          status: options.failure,
          json: { message: "Insufficient available balance" },
        });
      accepted = true;
      return route.fulfill({
        status: 201,
        json: { id: "bid1", ...requests.at(-1) },
      });
    }
    if (new URL(route.request().url()).pathname.endsWith("/me"))
      return route.fulfill({
        json: {
          bidderAlias: "bidder_public",
          isLeading: accepted || !!options.leading,
          position: accepted ? 1 : null,
          bestBid: accepted ? {} : null,
        },
      });
    return route.fulfill({
      json: {
        lotId: lot.id,
        status: options.status ?? "open",
        serverTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        currency: "USD",
        startingBid: "100.00",
        currentBid: accepted ? requests.at(-1)!.amount : null,
        minimumNextBid: "100.00",
        total: accepted ? 1 : 0,
        page: 1,
        limit: 20,
        items: accepted
          ? [
              {
                id: "bid1",
                bidderAlias: "bidder_public",
                bidderLabel: "Bidder A",
                amount: requests.at(-1)!.amount,
              },
            ]
          : [],
      },
    });
  });
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("bidder@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(page.locator(".hs-wallet-grid")).toBeVisible();
  await page.evaluate(() => {
    location.hash = "/";
  });
  await page
    .getByRole("button", { name: `View ${lot.title}`, exact: true })
    .click();
  return requests;
}

test("bid sends exact decimals, refreshes history/leadership and prevents self-overbidding", async ({
  page,
}) => {
  const requests = await room(page);
  await page.getByLabel("BID AMOUNT (USD)").fill("9007199254740993.01");
  await page.getByRole("button", { name: "PLACE BID", exact: true }).click();
  await expect(page.getByText("Bid accepted.", { exact: false })).toBeVisible();
  await expect(
    page.getByText("● YOU ARE CURRENTLY LEADING", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "PLACE BID", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("You", { exact: true })).toBeVisible();
  expect(requests[0].amount).toBe("9007199254740993.01");
  expect(requests[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
});

test("uncertain bid survives closing the room and retries the same key and amount", async ({
  page,
}) => {
  const requests = await room(page, { dropped: true });
  await page.getByLabel("BID AMOUNT (USD)").fill("125.00");
  await page.getByRole("button", { name: "PLACE BID", exact: true }).click();
  await expect(page.getByRole("button", { name: "RETRY BID" })).toBeVisible();
  await page.getByRole("button", { name: "Close artwork room" }).click();
  await page
    .getByRole("button", { name: `View ${lot.title}`, exact: true })
    .click();
  await expect(page.getByLabel("BID AMOUNT (USD)")).toHaveValue("$125.00");
  await expect(page.getByLabel("BID AMOUNT (USD)")).toBeDisabled();
  await page.getByRole("button", { name: "RETRY BID" }).click();
  await expect(page.getByText("Bid accepted.", { exact: false })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
});

test("server rejection is shown and a corrected bid gets a new key", async ({
  page,
}) => {
  const requests = await room(page, { failure: 400 });
  await page.getByLabel("BID AMOUNT (USD)").fill("125.00");
  await page.getByRole("button", { name: "PLACE BID", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Insufficient available balance",
  );
  await page.getByLabel("BID AMOUNT (USD)").fill("100.00");
  await page.getByRole("button", { name: "PLACE BID", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].idempotencyKey).not.toBe(requests[0].idempotencyKey);
});

for (const status of ["scheduled", "closed"])
  test(`cannot submit to a ${status} lot`, async ({ page }) => {
    const requests = await room(page, { status });
    await expect(
      page.getByRole("button", { name: "PLACE BID", exact: true }),
    ).toBeDisabled();
    expect(requests).toHaveLength(0);
  });

test("auctioneer cannot access bid entry", async ({ page }) => {
  const requests = await room(page, { role: "auctioneer" });
  await expect(
    page.getByText("Only bidder accounts can place bids."),
  ).toBeVisible();
  await expect(page.getByLabel("BID AMOUNT (USD)")).toHaveCount(0);
  expect(requests).toHaveLength(0);
});

test("currency digits format from the right, backspace removes cents, and cursor stays at the end", async ({
  page,
}) => {
  const requests = await room(page);
  const amount = page.getByLabel("BID AMOUNT (USD)");
  await amount.click();
  await amount.pressSequentially("123456");
  await expect(amount).toHaveValue("$1,234.56");
  await amount.press("ArrowLeft");
  expect(
    await amount.evaluate(
      (input: HTMLInputElement) => input.selectionStart === input.value.length,
    ),
  ).toBe(true);
  await amount.press("Backspace");
  await expect(amount).toHaveValue("$123.45");
  await page.getByRole("button", { name: "PLACE BID", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].amount).toBe("123.45");
});
