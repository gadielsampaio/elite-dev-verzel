import { test, expect } from "@playwright/test";
import { setup, lot } from "./support/api";
const web = "https://images.example.org/web.jpg",
  print = "https://images.example.org/print.jpg",
  full = "https://images.example.org/full.tif";
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>';
for (const outcome of ["loaded", "failed", "absent"] as const) {
  test(`room keeps web preview until high resolution is ${outcome}`, async ({
    page,
  }) => {
    await setup(page);
    const artwork = {
      ...lot,
      items: [
        {
          ...lot.items[0],
          imageUrl: web,
          printImageUrl: outcome === "absent" ? null : print,
        },
      ],
    };
    await page.route(`**/api/lots/${lot.id}`, (r) =>
      r.fulfill({ json: artwork }),
    );
    await page.route(web, (r) =>
      r.fulfill({ contentType: "image/svg+xml", body: svg }),
    );
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let requested!: () => void;
    const started = new Promise<void>((r) => (requested = r));
    let fullRequests = 0;
    await page.route(full, (r) => {
      fullRequests++;
      return r.abort();
    });
    await page.route(print, async (r) => {
      requested();
      await gate;
      if (outcome === "failed") await r.abort();
      else await r.fulfill({ contentType: "image/svg+xml", body: svg });
    });
    await page.goto(`/#/lot/${lot.id}`);
    const image = page
      .getByRole("region", { name: "Artwork viewer" })
      .getByRole("img");
    await expect(image).toHaveAttribute("src", web);
    await expect(image).toBeVisible();
    if (outcome !== "absent") {
      await started;
      await expect(image).toHaveAttribute("src", web);
      const completed =
        outcome === "failed"
          ? page.waitForEvent("requestfailed", (r) => r.url() === print)
          : page.waitForResponse(print);
      release();
      await completed;
      await expect(image).toHaveAttribute(
        "src",
        outcome === "loaded" ? print : web,
      );
    }
    expect(fullRequests).toBe(0);
  });
}

test("new viewer supports zoom, keyboard panning and reset", async ({
  page,
}) => {
  await setup(page);
  await page.route(`**/api/lots/${lot.id}`, (r) =>
    r.fulfill({
      json: { ...lot, items: [{ ...lot.items[0], imageUrl: web }] },
    }),
  );
  await page.route(web, (r) =>
    r.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await page.goto(`/#/lot/${lot.id}`);
  const viewer = page.getByRole("region", { name: "Artwork viewer" });
  await expect(viewer.getByRole("img")).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".hs-zoom-tools output")).toHaveText("150%");
  await expect(viewer).toHaveCSS("touch-action", "none");
  await viewer.focus();
  await viewer.press("ArrowRight");
  await expect
    .poll(() =>
      viewer
        .locator("div")
        .first()
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect(page.locator(".hs-zoom-tools output")).toHaveText("100%");
  await expect
    .poll(() =>
      viewer
        .locator("div")
        .first()
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41),
    )
    .toBe(0);
});

test("immersive scene preserves desktop geometry and caption controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.route(`**/api/lots/${lot.id}`, (r) =>
    r.fulfill({
      json: { ...lot, items: [{ ...lot.items[0], imageUrl: web }] },
    }),
  );
  await page.route(web, (r) =>
    r.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await page.goto(`/#/lot/${lot.id}`);
  await expect(page.locator("#lot-img")).toBeVisible();
  const scene = await page.locator(".hs-immersive-scene").boundingBox();
  expect(scene).toMatchObject({ x: 0, y: 0, width: 1440, height: 1000 });
  const figure = await page.locator(".hs-art-figure").boundingBox();
  expect(figure!.y).toBeCloseTo(90, 0);
  expect(figure!.width).toBeCloseTo(1440 * 0.76, 0);
  expect(figure!.height).toBeCloseTo(770, 0);
  const room = page.getByRole("dialog");
  await expect(room).toHaveClass(/caption-visible/);
  await page
    .getByRole("region", { name: "Artwork viewer" })
    .click({ position: { x: 20, y: 100 } });
  await expect(room).not.toHaveClass(/caption-visible/);
  await expect(
    page.getByRole("tab", { name: "Bid", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close artwork room", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(room).toHaveCount(0);
});

test("room skeleton yields to web preview before requesting high resolution", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  let releaseLot!: () => void;
  let releaseWeb!: () => void;
  let releasePrint!: () => void;
  const lotGate = new Promise<void>(resolve => { releaseLot = resolve; });
  const webGate = new Promise<void>(resolve => { releaseWeb = resolve; });
  const printGate = new Promise<void>(resolve => { releasePrint = resolve; });
  let printRequested = false;
  await page.route(`**/api/lots/${lot.id}`, async route => {
    await lotGate;
    await route.fulfill({ json: { ...lot, items: [{ ...lot.items[0], imageUrl: web, printImageUrl: print }] } });
  });
  await page.route(web, async route => {
    await webGate;
    await route.fulfill({ contentType: "image/svg+xml", body: svg });
  });
  await page.route(print, async route => {
    printRequested = true;
    await printGate;
    await route.fulfill({ contentType: "image/svg+xml", body: svg });
  });
  await page.goto(`/#/lot/${lot.id}`);
  await expect(page.getByRole("status", { name: "Loading auction room…" })).toBeVisible();
  expect(await page.getByRole("dialog").boundingBox()).toMatchObject({ x: 0, y: 0, width: 1440, height: 1000 });
  releaseLot();
  const placeholder = page.getByRole("status", { name: "Loading artwork…" });
  await expect(placeholder).toBeVisible();
  expect(printRequested).toBe(false);
  releaseWeb();
  const image = page.locator("#lot-img");
  await expect(image).toHaveAttribute("src", web);
  await expect(placeholder).toHaveCount(0);
  await expect.poll(() => printRequested).toBe(true);
  releasePrint();
  await expect(image).toHaveAttribute("src", print);
  await expect(placeholder).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Loading auction room…" })).toHaveCount(0);
});
