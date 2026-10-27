import { test, expect, type Page } from "@playwright/test";
import { setup, lot, token } from "./support/api";
async function loginSeller(page: Page, role = "auctioneer") {
  await setup(page, { role });
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("seller@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(page.locator(".hs-wallet-grid")).toBeVisible();
}
const art = {
  articArtworkId: 141639,
  isPublicDomain: true,
  name: "Selected museum artwork",
  imageUrl: "https://example.invalid/art.jpg",
  artistDisplay: "Museum artist",
  provider: "cleveland",
  mediumDisplay: "Oil on canvas",
};
async function mockCatalog(page: Page) {
  await page.route("https://example.invalid/art.jpg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="gray"/></svg>',
    }),
  );
  await page.route("**/api/catalog/**", (route) =>
    route.fulfill({
      json: route.request().url().includes("/search?")
        ? { items: [art], page: 1, total: 1, provider: "cleveland" }
        : art,
    }),
  );
}
async function configure(page: Page) {
  await page.getByRole("tab", { name: "CREATE A LOT" }).click();
  await page.getByLabel("ARTWORK / ARTIST").fill("museum");
  await page.getByRole("button", { name: "SEARCH", exact: true }).click();
  await page.getByRole("button", { name: `Select ${art.name}` }).click();
  await page.getByLabel("LOT TITLE").fill("My persisted auction");
  await page.getByLabel("START DATE & TIME").fill("2030-01-01T12:00");
  await page.getByLabel("END DATE & TIME").fill("2030-01-02T12:00");
  await page.getByLabel("STARTING BID (USD)").fill("9007199254740993.01");
  await page.getByLabel("MINIMUM INCREMENT (USD)").fill("1.00");
  await page.getByLabel("ESTIMATED VALUE (USD)").fill("9007199254740994.01");
}
test("seller searches, publishes exact decimals, reopens own list and cancels", async ({
  page,
}) => {
  await loginSeller(page);
  await mockCatalog(page);
  let owned: unknown[] = [];
  let sent: Record<string, unknown> = {};
  let cancellations = 0;
  await page.route("**/api/lots/mine?**", (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    return route.fulfill({
      json: { items: owned, total: owned.length, page: 1, limit: 9 },
    });
  });
  await page.route("**/api/lots", (route) => {
    sent = route.request().postDataJSON();
    const record = {
      ...lot,
      ...sent,
      title: sent.title,
      canCancel: true,
      bidCount: 0,
    };
    owned = [record];
    return route.fulfill({ status: 201, json: record });
  });
  await page.route(`**/api/lots/${lot.id}/cancel`, (route) => {
    cancellations++;
    owned = [
      {
        ...lot,
        title: "My persisted auction",
        status: "cancelled",
        canCancel: false,
        bidCount: 0,
      },
    ];
    return route.fulfill({ json: { status: "cancelled" } });
  });
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "SELLER STUDIO" })
    .click();
  await expect(page.getByText("No lots yet.", { exact: false })).toBeVisible();
  await configure(page);
  await page.getByRole("button", { name: "PUBLISH LOT", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "LOT PUBLISHED" }),
  ).toBeVisible();
  expect(sent.startingBid).toBe("9007199254740993.01");
  expect(sent.artworkId).toBe(141639);
  expect(sent).not.toHaveProperty("ownerId");
  expect(String(sent.startTime)).toMatch(/Z$/);
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "WALLET" })
    .click();
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "SELLER STUDIO" })
    .click();
  await expect(page.locator(".hs-seller-row")).toContainText(
    "My persisted auction",
  );
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "CANCEL LOT", exact: true }).click();
  await expect(page.locator(".hs-seller-row")).toContainText("cancelled");
  expect(cancellations).toBe(1);
  await expect(
    page.getByRole("button", { name: "CANCEL LOT", exact: true }),
  ).toHaveCount(0);
});
test("unconfirmed publication cannot be repeated; seller can inspect own lots", async ({
  page,
}) => {
  await loginSeller(page);
  await mockCatalog(page);
  await page.route("**/api/lots/mine?**", (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, limit: 9 } }),
  );
  let creates = 0;
  await page.route("**/api/lots", (route) => {
    creates++;
    return route.abort();
  });
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "SELLER STUDIO" })
    .click();
  await configure(page);
  await page.getByRole("button", { name: "PUBLISH LOT", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Publication was not confirmed",
  );
  await expect(
    page.getByRole("button", { name: "PUBLISH LOT", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "MY LOTS" }).click();
  await expect(page.getByText("No lots yet.", { exact: false })).toBeVisible();
  expect(creates).toBe(1);
});
test("bidder cannot access seller tools or issue a seller query", async ({
  page,
}) => {
  await loginSeller(page, "bidder");
  let calls = 0;
  await page.route("**/api/lots/mine?**", (route) => {
    calls++;
    return route.abort();
  });
  await page.goto("/#/seller");
  await expect(page.getByRole("alert")).toContainText("require an auctioneer");
  await expect(page.getByRole("tab", { name: "CREATE A LOT" })).toHaveCount(0);
  expect(calls).toBe(0);
});
test("cancellation conflict refreshes eligibility and keeps server reason", async ({
  page,
}) => {
  await loginSeller(page);
  let canCancel = true;
  await page.route("**/api/lots/mine?**", (route) =>
    route.fulfill({
      json: {
        items: [{ ...lot, canCancel, bidCount: canCancel ? 0 : 1 }],
        total: 1,
        page: 1,
        limit: 9,
      },
    }),
  );
  await page.route(`**/api/lots/${lot.id}/cancel`, (route) => {
    canCancel = false;
    return route.fulfill({
      status: 409,
      json: { message: "A lot that has received bids cannot be cancelled" },
    });
  });
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "SELLER STUDIO" })
    .click();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "CANCEL LOT", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("received bids");
  await expect(
    page.getByRole("button", { name: "CANCEL LOT", exact: true }),
  ).toHaveCount(0);
});

test("catalog supports type-only, text-only and combined filters while retaining applied pagination", async ({
  page,
}) => {
  await loginSeller(page);
  await mockCatalog(page);
  const searches: URL[] = [];
  await page.route("**/api/catalog/search?**", (route) => {
    const url = new URL(route.request().url());
    searches.push(url);
    return route.fulfill({
      json: {
        items: [art],
        total: 20,
        page: Number(url.searchParams.get("page")),
        provider: "cleveland",
      },
    });
  });
  await page.evaluate(() => {
    location.hash = "/seller";
  });
  await page.getByRole("tab", { name: "CREATE A LOT" }).click();
  const search = page.getByRole("button", { name: "SEARCH", exact: true });
  await expect(search).toBeDisabled();
  await page
    .getByLabel("ARTWORK TYPE", { exact: true })
    .selectOption("Painting");
  await search.click();
  await expect(
    page.getByRole("button", { name: `Select ${art.name}` }),
  ).toBeVisible();
  expect(searches.at(-1)?.searchParams.get("q")).toBeNull();
  expect(searches.at(-1)?.searchParams.get("type")).toBe("Painting");
  await page.getByLabel("ARTWORK / ARTIST").fill("Monet");
  await page.getByLabel("ARTWORK TYPE", { exact: true }).selectOption("");
  await search.click();
  await expect(
    page.getByRole("button", { name: `Select ${art.name}` }),
  ).toBeVisible();
  expect(searches.at(-1)?.searchParams.get("q")).toBe("Monet");
  expect(searches.at(-1)?.searchParams.get("type")).toBeNull();
  await page
    .getByLabel("ARTWORK TYPE", { exact: true })
    .selectOption("Painting");
  await search.click();
  await expect(
    page.getByRole("button", { name: `Select ${art.name}` }),
  ).toBeVisible();
  await page.getByLabel("ARTWORK / ARTIST").fill("Unsubmitted text");
  await page.getByRole("button", { name: "NEXT", exact: true }).click();
  await expect(page.getByText("PAGE 2", { exact: true })).toBeVisible();
  expect(searches.at(-1)?.searchParams.get("q")).toBe("Monet");
  expect(searches.at(-1)?.searchParams.get("type")).toBe("Painting");
  await page.getByRole("button", { name: `Select ${art.name}` }).click();
  await page.getByRole("button", { name: "CHANGE ARTWORK" }).click();
  await expect(page.getByLabel("ARTWORK TYPE", { exact: true })).toHaveValue(
    "Painting",
  );
  await expect(page.getByText("PAGE 2", { exact: true })).toBeVisible();
});
