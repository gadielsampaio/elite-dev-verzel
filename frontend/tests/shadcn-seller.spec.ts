import { test, expect, type Page } from "@playwright/test";
import { setup, lot, token } from "./support/api";
const art = {
  articArtworkId: 141639,
  name: "Museum painting",
  artistDisplay: "Museum artist",
  imageUrl: "https://example.invalid/seller-art.svg",
  isPublicDomain: true,
  provider: "cleveland",
  artworkType: "Painting",
};
async function login(page: Page, role = "auctioneer") {
  await setup(page, { role });
  await page.route("**/api/lots/mine?**", (r) =>
    r.fulfill({ json: { items: [], page: 1, total: 0 } }),
  );
  await page.route("**/api/me/auction-results?**", (r) =>
    r.fulfill({ json: { items: [], page: 1, total: 0 } }),
  );
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("seller@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#shadcn-login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  await page.goto("/#/seller");
  await expect(
    page.getByRole("heading", { name: "Seller Studio", exact: true }),
  ).toBeVisible();
}
async function catalog(page: Page) {
  await page.route(art.imageUrl, (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="gray"/></svg>',
    }),
  );
  await page.route("**/api/catalog/**", (r) => {
    const url = new URL(r.request().url());
    return r.fulfill({
      json: url.pathname.endsWith("/search")
        ? {
            items: [art],
            total: 18,
            page: Number(url.searchParams.get("page")),
            provider: "cleveland",
          }
        : art,
    });
  });
  await page.getByRole("tab", { name: "Create a lot", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Artwork type", exact: true }),
  ).toHaveText("Paintings");
  await page.getByRole("button", { name: "SEARCH", exact: true }).click();
}
async function details(page: Page) {
  await page.getByRole("button", { name: `Select ${art.name}` }).click();
  await page
    .getByRole("combobox", { name: "Publication", exact: true })
    .click();
  await page.getByRole("option", { name: "Publish now", exact: true }).click();
  await page
    .getByLabel("Starting bid (USD)", { exact: true })
    .fill("9007199254740993.01");
  await page
    .getByLabel("Minimum increment (USD)", { exact: true })
    .fill("1.00");
  await page
    .getByLabel("Estimated value (USD)", { exact: true })
    .fill("9007199254740994.01");
}
test("catalog keeps filters and publishes exact amounts; owned lot can be cancelled", async ({
  page,
}) => {
  await login(page);
  await catalog(page);
  await page
    .getByLabel("Artwork / Artist", { exact: true })
    .fill("unsubmitted edit");
  const next = page.waitForRequest(
    (r) => r.url().includes("/catalog/search?") && r.url().includes("page=2"),
  );
  await page.getByRole("button", { name: "Next page" }).click();
  expect(new URL((await next).url()).searchParams.get("q")).toBeNull();
  await details(page);
  await page.getByRole("button", { name: "BACK TO COLLECTION" }).click();
  await expect(page.getByLabel("Artwork type", { exact: true })).toHaveText(
    "Paintings",
  );
  await details(page);
  let owned = [{ ...lot, title: art.name, canCancel: true, bidCount: 0 }];
  await page.route("**/api/lots", (r) => {
    expect(r.request().headers().authorization).toBe(`Bearer ${token}`);
    expect(r.request().postDataJSON()).toMatchObject({
      startingBid: "9007199254740993.01",
      estimatedValue: "9007199254740994.01",
      bidIncrement: "1.00",
      startMode: "now",
    });
    expect(r.request().postDataJSON()).not.toHaveProperty("startTime");
    return r.fulfill({ status: 201, json: owned[0] });
  });
  await page.route("**/api/lots/mine?**", (r) =>
    r.fulfill({ json: { items: owned, total: owned.length, page: 1 } }),
  );
  await page.getByRole("button", { name: "PUBLISH LOT", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lot published!", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "My lots", exact: true })
    .click();
  await page.getByRole("tab", { name: "My lots", exact: true }).click();
  await expect(
    page.getByRole("link", { name: `View lot ${art.name}` }),
  ).toHaveAttribute("href", `/#/lot/${lot.id}`);
  await page.route(`**/api/lots/${lot.id}/cancel`, (r) => {
    owned = [];
    return r.fulfill({ json: {} });
  });
  await page.getByRole("button", { name: "Cancel lot", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Cancel lot?" });
  await expect(confirmation).toBeVisible();
  await confirmation
    .getByRole("button", { name: "Keep lot", exact: true })
    .click();
  await expect(confirmation).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel lot", exact: true }).click();
  await confirmation
    .getByRole("button", { name: "Cancel lot", exact: true })
    .click();
  await expect(
    page.getByText("Lot cancelled. Any reserved funds have been released as a refund."),
  ).toBeVisible();
});
test("validation is inline and uncertain publication cannot be retried", async ({
  page,
}) => {
  await login(page);
  await catalog(page);
  await details(page);
  await page.getByLabel("Lot title", { exact: true }).fill("");
  await page.getByRole("button", { name: "PUBLISH LOT", exact: true }).click();
  await expect(page.getByLabel("Lot title", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Lot title", { exact: true })).toBeFocused();
  await page.getByLabel("Lot title", { exact: true }).fill("Auction title");
  let calls = 0;
  await page.route("**/api/lots", (r) => {
    calls++;
    return r.fulfill({ status: 503, json: { message: "Unavailable" } });
  });
  await page.getByRole("button", { name: "PUBLISH LOT", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Publication was not confirmed",
  );
  await expect(
    page.getByRole("button", { name: "PUBLISH LOT", exact: true }),
  ).toBeDisabled();
  expect(calls).toBe(1);
  await page.getByRole("tab", { name: "My lots", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your collection" }),
  ).toBeVisible();
});
test("results distinguish pending settlement and receipt availability", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/me/auction-results?**", (r) =>
    r.fulfill({
      json: {
        page: 1,
        total: 2,
        items: [
          {
            lotId: lot.id,
            title: "Pending auction",
            status: "closed",
            outcome: "pending_settlement",
            amount: null,
            receiptPath: null,
            currency: "USD",
          },
          {
            lotId: "settled-id",
            title: "Sold auction",
            status: "closed",
            outcome: "settled",
            amount: "100.00",
            receiptPath: "/receipts/settled-id",
            currency: "USD",
          },
        ],
      },
    }),
  );
  await page.getByRole("tab", { name: "Results", exact: true }).click();
  await expect(
    page.getByText("Settlement pending", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Result/Receipt", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Result/Receipt", exact: true }),
  ).toHaveAttribute("href", "/#/receipt/settled-id");
});
test("bidder cannot access seller controls or request seller data", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/(lots\/mine|me\/auction-)/.test(r.url())) calls.push(r.url());
  });
  await login(page, "bidder");
  await expect(
    page.getByText(
      "An auctioneer account is required to publish and manage lots.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Create a lot" })).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("create action scrolls, dropdown supports categories, reload preserves applied filters", async ({
  page,
}) => {
  await login(page);
  await catalog(page);
  await expect(
    page.getByRole("button", { name: `Select ${art.name}` }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Artwork type" }).click();
  await page.getByRole("option", { name: "Drawings", exact: true }).click();
  await page.getByRole("button", { name: "SEARCH", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Select ${art.name}` }),
  ).toBeVisible();
  const request = page.waitForRequest((r) =>
    r.url().includes("/catalog/search?"),
  );
  await page.getByRole("button", { name: "Reload artwork" }).click();
  expect(new URL((await request).url()).searchParams.get("type")).toBe(
    "Drawing",
  );
  await expect(
    page.getByRole("button", { name: `Select ${art.name}` }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "My lots", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Create lot +", exact: true }).click();
  await expect
    .poll(() =>
      page
        .getByRole("heading", { name: "Create a lot", exact: true })
        .evaluate((e) => Math.abs(e.getBoundingClientRect().top)),
    )
    .toBeLessThan(100);
});

test("search alignment and artwork card hierarchy work on desktop and mobile", async ({
  page,
}) => {
  await login(page);
  await catalog(page);
  await expect(
    page.getByRole("button", { name: `Select ${art.name}` }),
  ).toBeVisible();
  const controls = [
    page.getByLabel("Artwork / Artist", { exact: true }),
    page.getByRole("combobox", { name: "Artwork type" }),
    page.getByRole("button", { name: "SEARCH", exact: true }),
  ];
  const boxes = await Promise.all(controls.map((c) => c.boundingBox()));
  expect(
    Math.max(...boxes.map((b) => b!.y)) - Math.min(...boxes.map((b) => b!.y)),
  ).toBeLessThan(2);
  expect(boxes.map((b) => b!.height)).toEqual([48, 48, 48]);
  const card = page.getByRole("button", { name: `Select ${art.name}` });
  await expect(card.getByText(art.name, { exact: true })).toBeVisible();
  await card.hover();
  await page.screenshot({
    path: "/tmp/seller-catalog-refined.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("calendar and time inputs preserve scheduled timestamps and focus invalid fields", async ({
  page,
}) => {
  await login(page);
  await catalog(page);
  await details(page);
  await expect(
    page.getByRole("button", { name: "Start date & time", exact: true }),
  ).toBeDisabled();
  await page.getByRole("combobox", { name: "Publication" }).click();
  await page.getByRole("option", { name: "Schedule" }).click();
  for (const label of ["Start date & time", "End date & time"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const popover = page.getByRole("dialog", { name: `${label} calendar` });
    await expect(popover).toBeVisible();
    await popover.getByRole("button", { name: /next month/i }).click();
    if (label.startsWith("End"))
      await popover.getByRole("button", { name: /next month/i }).click();
    await popover.locator("button[data-day]").nth(15).click();
  }
  await page
    .getByLabel("Start date & time time", { exact: true })
    .fill("10:30");
  await page.getByLabel("End date & time time", { exact: true }).fill("");
  await page.getByRole("button", { name: "PUBLISH LOT", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "End date & time", exact: true }),
  ).toBeFocused();
  await page.getByLabel("End date & time time", { exact: true }).fill("11:45");
  const expected = await page
    .locator('form[aria-label="Lot details"]')
    .evaluate((form) => {
      const data = new FormData(form as HTMLFormElement);
      return {
        startTime: new Date(String(data.get("startTime"))).toISOString(),
        endTime: new Date(String(data.get("endTime"))).toISOString(),
      };
    });
  await page.route("**/api/lots", (r) => {
    expect(r.request().postDataJSON()).toMatchObject(expected);
    return r.fulfill({ status: 201, json: lot });
  });
  await page.screenshot({
    path: "/tmp/seller-dates-refined.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "PUBLISH LOT", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lot published!", exact: true }),
  ).toBeVisible();
});

test("publication defaults to now and scheduling blocks past dates and times", async ({
  page,
}) => {
  await login(page);
  await catalog(page);
  await page.getByRole("button", { name: `Select ${art.name}` }).click();
  await expect(page.getByRole("combobox", { name: "Publication" })).toHaveText(
    "Publish now",
  );
  await expect(
    page.getByRole("button", { name: "Start date & time", exact: true }),
  ).toBeDisabled();
  await page.getByRole("combobox", { name: "Publication" }).click();
  await page.getByRole("option", { name: "Schedule", exact: true }).click();
  await page
    .getByRole("button", { name: "Start date & time", exact: true })
    .click();
  const dates = await page.evaluate(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    return {
      today: today.toLocaleDateString(),
      yesterday: yesterday.toLocaleDateString(),
    };
  });
  const popup = page.getByRole("dialog", {
    name: "Start date & time calendar",
  });
  await expect(
    popup.locator(`button[data-day="${dates.yesterday}"]`),
  ).toBeDisabled();
  await popup.locator(`button[data-day="${dates.today}"]`).click();
  const time = page.getByLabel("Start date & time time", { exact: true });
  await expect(time).toHaveAttribute("min", /\d{2}:\d{2}/);
  await time.fill("00:00");
  await page.getByLabel("Lot title", { exact: true }).click();
  expect(
    await page
      .locator('input[name="startTime"]')
      .evaluate(
        (el) => new Date((el as HTMLInputElement).value).getTime() > Date.now(),
      ),
  ).toBe(true);
});
