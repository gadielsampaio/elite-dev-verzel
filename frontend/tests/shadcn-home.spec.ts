import { test, expect, type Page } from "@playwright/test";
import { lot } from "./support/api";
const published = {
  ...lot,
  status: "open",
  items: [
    {
      ...lot.items[0],
      imageUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='560'%3E%3Crect width='900' height='560' fill='%237d6952'/%3E%3C/svg%3E",
    },
  ],
};
async function setup(page: Page) {
  const requests: string[] = [];
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    if (url.pathname.endsWith("/refresh"))
      return route.fulfill({ status: 401, json: { message: "Unauthorized" } });
    if (url.pathname.endsWith("/bids"))
      return route.fulfill({
        json: {
          currentBid: "105.00",
          currency: "USD",
          serverTime: "2027-01-01T18:00:00Z",
          endTime: lot.endTime,
        },
      });
    return route.fulfill({
      json: {
        items: [published],
        total: 10,
        page: Number(url.searchParams.get("page")),
        limit: 9,
      },
    });
  });
  return requests;
}
for (const width of [1440, 390])
  test(`theme, navigation and responsive layout at ${width}px`, async ({
    page,
  }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(lot.title);
    await expect(page.getByText("$105.00")).toBeVisible();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(245, 239, 227)",
    );
    await expect(page.locator("body")).toHaveCSS("font-family", /DM Sans/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(26, 26, 26)",
    );
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Switch to light mode" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View featured lot" }),
    ).toHaveAttribute("href", `/#/lot/${lot.id}`);
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "View featured lot" }),
    ).toBeVisible();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(26, 26, 26)",
    );
    await expect(page.locator("body")).toHaveCSS("font-family", /DM Sans/);
  });
test("search, keyboard tabs and pagination retain server filters", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.goto("/");
  await page.getByRole("searchbox").fill("nonexistent");
  await expect(page.getByText("NO MATCHES ON THIS PAGE")).toBeVisible();
  await page.getByRole("tab", { name: "ALL LOTS", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "LIVE NOW", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "UPCOMING", exact: true }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect
    .poll(() =>
      requests.some(
        (r) => r.includes("page=2") && r.includes("status=scheduled"),
      ),
    )
    .toBe(true);
  await expect(page.getByRole("tabpanel")).toBeVisible();
});
test("API failures offer retries and empty data never becomes sample lots", async ({
  page,
}) => {
  await setup(page);
  let fail = true;
  await page.route("**/api/lots?**", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { message: "Database unavailable" } }
        : { json: { items: [], total: 0, page: 1, limit: 9 } },
    ),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toHaveCount(2);
  fail = false;
  await page.getByRole("button", { name: "Retry featured lot" }).click();
  await page.getByRole("button", { name: "Retry lots", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Coming soon",
  );
  await expect(page.getByText("NO LOTS FOUND")).toBeVisible();
});

test("header shows account identity and accessible icon logout", async ({
  page,
}) => {
  const { user, token } = await import("./support/api");
  await setup(page);
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ json: { accessToken: token } }),
  );
  await page.route(`**/api/users/${user.id}`, (route) =>
    route.fulfill({ json: { ...user, name: "Gadiel", role: "auctioneer" } }),
  );
  let signedOut = false;
  await page.route("**/api/auth/logout", (route) => {
    signedOut = true;
    return route.fulfill({ status: 204 });
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto("/");
  const identity = page.getByText("Gadiel – Auctioneer", { exact: true });
  const signOut = page.getByRole("button", { name: "Sign out" });
  await expect(identity).toBeVisible();
  await expect(signOut).toHaveText("");
  await expect(signOut.locator("svg")).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("font-family", /DM Sans/);
  await expect(page.locator("h1")).toHaveCSS("font-family", /Sora/);
  const nameBox = await identity.boundingBox();
  const brandBox = await page
    .locator("header")
    .getByRole("link", { name: "HAUS SAMPAIO" })
    .boundingBox();
  expect(
    Math.abs(
      nameBox!.y + nameBox!.height / 2 - brandBox!.y - brandBox!.height / 2,
    ),
  ).toBeLessThan(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(identity).toBeVisible();
  await expect(signOut).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await signOut.click();
  await expect.poll(() => signedOut).toBe(true);
  await expect(identity).toHaveCount(0);
  await expect(
    page
      .locator("header")
      .getByRole("link", { name: /LOG IN/ })
      .last(),
  ).toBeVisible();
});

test("numbered pagination handles ellipses, boundaries and filter reset", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.route("**/api/lots?**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    return route.fulfill({
      json: {
        items: [published],
        total: 90,
        page: Number(url.searchParams.get("page")),
        limit: 9,
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Lot pagination" });
  await expect(
    nav.getByRole("button", { name: "Previous page" }),
  ).toBeDisabled();
  await expect(
    nav.getByRole("button", { name: "Page 1", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("tab", { name: "UPCOMING", exact: true }).click();
  await nav.getByRole("button", { name: "Page 10", exact: true }).click();
  await expect(nav.getByRole("button", { name: "Next page" })).toBeDisabled();
  await expect
    .poll(() =>
      requests.some(
        (url) => url.includes("page=10") && url.includes("status=scheduled"),
      ),
    )
    .toBe(true);
  await nav.getByRole("button", { name: "Previous page" }).click();
  await expect(
    nav.getByRole("button", { name: "Page 9", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("tab", { name: "ALL LOTS", exact: true }).click();
  await expect(
    nav.getByRole("button", { name: "Page 1", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(nav.getByText("More pages")).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

for (const [path, width] of [["/", 1440], ["/#/home", 390]] as const) {
  test(`explore auctions scrolls without changing route at ${width}px`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    const url = page.url();
    const explore = page.getByText("EXPLORE THE AUCTIONS", { exact: true });
    await explore.focus();
    await explore.press("Enter");
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(lot.title);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect.poll(() => page.locator("#catalog").evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(400);
  });
}
