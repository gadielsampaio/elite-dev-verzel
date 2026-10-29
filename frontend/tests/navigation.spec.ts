import { test, expect } from "@playwright/test";
import { setup, lot } from "./support/api";

for (const path of [`/lots/${lot.id}`, `/shadcn#/lot/${lot.id}`])
  test(`existing link ${path} uses the single application`, async ({
    page,
  }) => {
    await setup(page);
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/#/lot/${lot.id}$`));
    await expect(
      page.getByRole("tab", { name: "Artwork details", exact: true }),
    ).toBeVisible();
  });

test("internal navigation keeps the document and does not fade the page to blank", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: `View ${lot.title}`, exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.assign(window, { navigationMarker: "same-document" }),
  );
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "PUBLIC AUDIT" }).click();
  await expect(page).toHaveURL(/#\/audit$/);
  expect(
    await page
      .locator("main")
      .evaluate((el) => Number(getComputedStyle(el).opacity)),
  ).toBe(1);
  await nav.getByRole("link", { name: "AUCTIONS", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { navigationMarker: string }).navigationMarker,
    ),
  ).toBe("same-document");
});

test("pagination retains the current cards while the next page loads", async ({
  page,
}) => {
  await setup(page);
  let release: (() => void) | undefined;
  await page.route("**/api/lots?**", async (route) => {
    const next =
      new URL(route.request().url()).searchParams.get("page") === "2";
    if (next)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({
      json: {
        items: [{ ...lot, title: next ? "Next artwork" : "Current artwork" }],
        total: 18,
        page: next ? 2 : 1,
        limit: 9,
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "View Current artwork", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect.poll(() => !!release).toBe(true);
  await expect(
    page.getByRole("link", { name: "View Current artwork", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  release!();
  await expect(
    page.getByRole("link", { name: "View Next artwork", exact: true }),
  ).toBeVisible();
});

test("back, forward and reload keep the matching route and navigation state", async ({ page }) => {
  await setup(page);
  await page.goto("/#/home");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const auctions = nav.getByRole("link", { name: "AUCTIONS", exact: true });
  const audit = nav.getByRole("link", { name: "PUBLIC AUDIT", exact: true });

  await expect(auctions).toHaveAttribute("aria-current", "page");
  await audit.click();
  await expect(page.getByRole("heading", { name: "Public audit", exact: true })).toBeVisible();
  await expect(audit).toHaveAttribute("aria-current", "page");

  await page.goBack();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(auctions).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: `View ${lot.title}`, exact: true })).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/#\/audit$/);
  await expect(audit).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Public audit", exact: true })).toBeVisible();
});

test("changing lot parameters updates the room through browser history", async ({ page }) => {
  await setup(page);
  const secondId = "33333333-3333-4333-8333-333333333333";
  await page.route(`**/api/lots/${secondId}`, (route) => route.fulfill({
    json: { ...lot, id: secondId, title: "Second artwork" },
  }));
  await page.goto(`/#/lot/${lot.id}`);
  await expect(page.getByRole("heading", { name: lot.title, exact: true, level: 2 })).toBeVisible();
  await page.evaluate((id) => { location.hash = `/lot/${id}`; }, secondId);
  await expect(page.getByRole("heading", { name: "Second artwork", exact: true, level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: lot.title, exact: true, level: 2 })).toHaveCount(0);

  await page.goBack();
  await expect(page.getByRole("heading", { name: lot.title, exact: true, level: 2 })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Second artwork", exact: true, level: 2 })).toBeVisible();
});

test("invalid login return destinations stay inside the application", async ({ page }) => {
  await setup(page);
  await page.goto("/#/login?lot=https%3A%2F%2Fexample.com&receipt=%2F%2Fevil.example");
  await page.getByLabel("EMAIL ADDRESS").fill("bidder@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page.locator("#shadcn-login-form").getByRole("button", { name: "LOG IN", exact: true }).click();
  await expect(page).toHaveURL(/\/#\/home$/);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
});
