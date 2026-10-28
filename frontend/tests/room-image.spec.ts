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
    await page.goto("/");
    await page
      .getByRole("button", { name: `View ${lot.title}`, exact: true })
      .click();
    const image = page.locator("#lot-img");
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
