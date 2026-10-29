import { test, expect } from "@playwright/test";
import { setup, lot } from "./support/api";
for (const path of ["/#/missing-page", "/shadcn/missing-page", "/missing-page"])
  test(`centered 404 for ${path}`, async ({ page }) => {
    const mock = await setup(page);
    await page.goto(path);
    const title = page.getByRole("heading", {
      name: "Page not found",
      exact: true,
    });
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS("text-align", "center");
    const box = await title.boundingBox();
    expect(
      Math.abs(box!.x + box!.width / 2 - page.viewportSize()!.width / 2),
    ).toBeLessThan(2);
    await page
      .getByRole("link", { name: "Back to auctions", exact: true })
      .click();
    await expect(page).toHaveURL(/#\/home$/);
    await expect(
      page.getByRole("heading", { name: "Page not found", exact: true }),
    ).toHaveCount(0);
  });
test("session and content skeletons disappear when their requests complete", async ({
  page,
}) => {
  await setup(page);
  let releaseSession!: () => void, releaseLots!: () => void;
  const sessionGate = new Promise<void>(
    (resolve) => (releaseSession = resolve),
  );
  const lotsGate = new Promise<void>((resolve) => (releaseLots = resolve));
  await page.route("**/api/auth/refresh", async (r) => {
    await sessionGate;
    await r.fulfill({ status: 401, json: { message: "Unauthorized" } });
  });
  await page.route("**/api/lots?**", async (r) => {
    await lotsGate;
    await r.fulfill({ json: { items: [lot], page: 1, limit: 9, total: 1 } });
  });
  try {
    await page.goto("/");
    const session = page.getByRole("status", {
      name: "Verifying your session",
    });
    await expect(session).toBeVisible();
    await expect(session).toHaveCSS("background-color", "rgb(245, 239, 227)");
    await expect(page.locator(".session-skeleton-nav")).toBeVisible();
    releaseSession();
    await expect(session).toHaveCount(0);
    const hero = page.getByRole("status", {
      name: "Loading auctions…",
      exact: true,
    });
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute("aria-busy", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(hero.locator(".animate-pulse").first()).toHaveCSS(
      "animation-name",
      "none",
    );
    releaseLots();
    await expect(hero).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 1, name: lot.title }),
    ).toBeVisible();
  } finally {
    releaseSession();
    releaseLots();
  }
});
