import { test, expect, type Page } from "@playwright/test";
async function profile(page: Page, name: string) {
  await page.locator(".hs-demo-link").click();
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
}
test("catalog filters, search, room controls and demo bidding", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/preview");
  await page.getByRole("tab", { name: "UPCOMING", exact: true }).click();
  await expect(page.locator(".hs-lot-card")).toHaveCount(1);
  await page.getByRole("tab", { name: "ALL LOTS" }).click();
  await page
    .getByRole("searchbox", { name: "Search artwork" })
    .fill("not found");
  await expect(page.getByText("NO LOTS FOUND")).toBeVisible();
  await page.getByRole("button", { name: "VIEW ALL", exact: true }).click();
  await expect(page.locator(".hs-lot-card")).toHaveCount(3);
  await page.getByRole("button", { name: "View featured lot" }).click();
  const room = page.getByRole("dialog");
  await expect(room).toBeVisible();
  await room.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(room.locator("output")).toHaveText("125%");
  await room.getByRole("button", { name: "PLACE DEMO BID" }).click();
  await expect(room.locator(".hs-p-feedback")).toHaveText(
    "Demo bid accepted — you are leading.",
  );
  await room.getByRole("button", { name: "PLACE DEMO BID" }).click();
  await expect(room.locator(".hs-p-feedback")).toHaveText(
    "You are already the highest bidder.",
  );
  await page.keyboard.press("Escape");
  await expect(room).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View featured lot" }),
  ).toBeFocused();
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "MY BIDS" })
    .click();
  await expect(page.locator("#page-activity")).toContainText("LEADING");
  expect(errors).toEqual([]);
});
test("auth validation, password visibility, localization and theme persistence", async ({
  page,
}) => {
  await page.goto("/preview#/register");
  const form = page.locator("#register-form");
  await form
    .getByRole("button", { name: "CREATE ACCOUNT", exact: true })
    .click();
  await expect(form.getByLabel("FULL NAME")).toBeFocused();
  await expect(form.locator('[aria-invalid="true"]')).toHaveCount(3);
  await form.getByLabel("FULL NAME").fill("Test Collector");
  await form.getByLabel("EMAIL ADDRESS").fill("test@example.com");
  await form.getByLabel("PASSWORD", { exact: true }).fill("password123");
  await form.getByLabel("CONFIRM PASSWORD").fill("password123");
  await form.getByRole("button", { name: "Show password" }).first().click();
  await expect(form.getByLabel("PASSWORD", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await form
    .getByRole("button", { name: "CREATE ACCOUNT", exact: true })
    .click();
  await expect(form.getByRole("status")).toContainText(
    "No account was created",
  );
  await page.getByRole("button", { name: "PT", exact: true }).click();
  await expect(page.locator("#register-title")).toContainText("DA COLEÇÃO.");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "password123",
  );
});
test("wallet deposits, profile restrictions and hash history", async ({
  page,
}) => {
  await page.goto("/preview#/wallet");
  await page.getByLabel("DEPOSIT AMOUNT").fill("1234");
  await expect(page.getByLabel("DEPOSIT AMOUNT")).toHaveValue("$12.34");
  await page.getByRole("button", { name: "SIMULATE DEPOSIT" }).click();
  await expect(page.locator("#page-wallet").getByRole("status")).toContainText(
    "Demo deposit added",
  );
  await expect(page.locator(".hs-wallet-grid strong").first()).toHaveText(
    "$90,012",
  );
  await profile(page, "Guest");
  await page.getByRole("button", { name: "SIMULATE DEPOSIT" }).click();
  await expect(page.locator("#page-wallet").getByRole("status")).toContainText(
    "Select a collector",
  );
  await page
    .locator(".hs-footer-links")
    .getByRole("button", { name: "PUBLIC AUDIT" })
    .click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "MY WALLET", exact: true }),
  ).toBeVisible();
});
test("seller sample validates, publishes, persists and cancels", async ({
  page,
}) => {
  await page.goto("/preview#/seller");
  await profile(page, "Auctioneer");
  await page
    .getByRole("button", { name: "CREATE LOT", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "USE A SAMPLE ARTWORK" }).click();
  await page.getByRole("button", { name: "PUBLISH DEMO LOT" }).click();
  await expect(page.getByLabel("STARTING BID", { exact: true })).toBeFocused();
  await page.getByLabel("STARTING BID", { exact: true }).fill("10000");
  await page.getByLabel("MINIMUM INCREMENT").fill("100");
  await page.getByLabel("ESTIMATED VALUE").fill("20000");
  await page.getByRole("button", { name: "PUBLISH DEMO LOT" }).click();
  await expect(page.getByText("LOT ADDED TO YOUR COLLECTION")).toBeVisible();
  await page.reload();
  const row = page
    .locator(".hs-seller-row")
    .filter({ hasText: "Twilight in the Wilderness" });
  await expect(row).toBeVisible();
  await profile(page, "Auctioneer");
  page.on("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "CANCEL LOT" }).click();
  await expect(row).toContainText("cancelled");
  await page.reload();
  await expect(row).toContainText("cancelled");
});
test("seller catalog errors, pagination and selection", async ({ page }) => {
  let requests = 0;
  await page.route(
    "https://openaccess-api.clevelandart.org/**",
    async (route) => {
      requests++;
      if (requests === 1) {
        await route.fulfill({ status: 503, json: {} });
        return;
      }
      const item = {
        id: 42,
        title: "Museum work",
        creators: [{ description: "Test artist" }],
        images: { web: { url: "https://example.com/art.jpg" } },
        share_license_status: "CC0",
        creation_date: "1900",
        technique: "Oil",
        type: "Painting",
      };
      await route.fulfill({
        json: route.request().url().includes("/42")
          ? { data: item }
          : { data: [item], info: { total: 10 } },
      });
    },
  );
  await page.goto("/preview#/seller");
  await page.getByRole("tab", { name: "CREATE A LOT" }).click();
  await page.getByLabel("ARTWORK / ARTIST").fill("Museum");
  await page.getByRole("button", { name: "SEARCH", exact: true }).click();
  await expect(
    page.getByText("CATALOG CURRENTLY UNAVAILABLE", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "SEARCH", exact: true }).click();
  await page.getByRole("button", { name: "NEXT →" }).click();
  await expect(page.getByText("PAGE 2 OF 2", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Select Museum work" }).click();
  await expect(page.getByLabel("LOT TITLE")).toHaveValue("Museum work");
});
test("mobile pages retain responsive layout and keyboard modal behavior", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");
  await expect(page.locator("#landing")).toBeVisible();
  for (const name of [
    "home",
    "login",
    "register",
    "wallet",
    "activity",
    "audit",
    "seller",
  ]) {
    await page.evaluate((name) => {
      location.hash = `/${name}`;
    }, name);
    await expect(page).toHaveURL(new RegExp(`#/${name}$`));
    await expect(
      page.locator(name === "home" ? "#landing" : `#page-${name}`),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page.goto("/preview#/login");
  await page.getByRole("button", { name: "EXPLORE DEMO PROFILES" }).click();
  await expect(
    page.getByRole("button", { name: "Close demo profiles" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "PUBLIC AUDIT" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "EXPLORE DEMO PROFILES" }),
  ).toBeFocused();
});
