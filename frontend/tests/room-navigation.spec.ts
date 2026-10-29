import { test, expect, type Page } from "@playwright/test";
import { setup, lot } from "./support/api";
const imageUrl = "https://images.example.org/navigation.jpg";
async function openRoom(page: Page) {
  await setup(page);
  await page.route(`**/api/lots/${lot.id}`, (r) =>
    r.fulfill({ json: { ...lot, items: [{ ...lot.items[0], imageUrl }] } }),
  );
  await page.route(imageUrl, (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#947454"/></svg>',
    }),
  );
  await page.goto("/");
  await page
    .getByRole("link", { name: `View ${lot.title}`, exact: true })
    .click();
  await expect(page.locator("#lot-img")).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".hs-zoom-tools output")).toHaveText("150%");
}
async function pan(page: Page) {
  return page.locator("#lot-figure").evaluate((el) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: matrix.m41, y: matrix.m42 };
  });
}
test.use({ reducedMotion: "reduce" });
test("zoomed room supports bounded drag, keyboard pan and reset without toggling captions", async ({
  page,
}) => {
  await openRoom(page);
  const scene = page.locator("#lot-scene"),
    box = (await scene.boundingBox())!;
  const caption = await page.getByRole("dialog").getAttribute("class");
  await page.mouse.move(box.x + 150, box.y + 220);
  await page.mouse.down();
  await page.mouse.move(box.x + 270, box.y + 280, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await pan(page)).x).toBeGreaterThan(50);
  await expect(page.getByRole("dialog")).toHaveAttribute("class", caption!);
  await scene.focus();
  const before = (await pan(page)).x;
  await scene.press("ArrowLeft");
  await expect.poll(async () => (await pan(page)).x).toBeLessThan(before);
  for (let i = 0; i < 20; i++) await scene.press("ArrowRight");
  const max = await page
    .locator("#lot-img")
    .evaluate((el) => (el as HTMLImageElement).offsetWidth * 0.25);
  expect((await pan(page)).x).toBeLessThanOrEqual(max + 0.1);
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(page.locator(".hs-zoom-tools output")).toHaveText("100%");
  await expect.poll(() => pan(page)).toEqual({ x: 0, y: 0 });
});
test.describe("touch navigation", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("touch drag pans the zoomed artwork", async ({ page }) => {
    await openRoom(page);
    const box = (await page.locator("#lot-scene").boundingBox())!;
    const client = await page.context().newCDPSession(page);
    const x = box.x + 100,
      y = box.y + 180;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 65, y: y + 30 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect.poll(async () => (await pan(page)).x).toBeGreaterThan(20);
    await expect(page.getByRole("dialog")).toHaveClass(/caption-visible/);
    await client.detach();
  });
});
