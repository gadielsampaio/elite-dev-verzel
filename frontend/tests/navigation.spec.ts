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
