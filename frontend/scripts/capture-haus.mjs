// Usage: node scripts/capture-haus.mjs [baseURL] [outputDirectory]
// Point baseURL at the original prototype's HTTP server to capture the baseline.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const baseURL = process.argv[2] || "http://127.0.0.1:5174/preview";
const output = process.argv[3] || "verification/current";
await mkdir(output, { recursive: true });
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_CHANNEL }
    : {},
);
try {
  for (const [size, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({
        viewport: { width, height },
        reducedMotion: "reduce",
      });
      await page.clock.setFixedTime(new Date("2026-10-27T20:00:00Z"));
      await page.addInitScript(
        (theme) => localStorage.setItem("haus-sampaio-theme", theme),
        theme,
      );
      for (const route of [
        "home",
        "login",
        "register",
        "seller",
        "wallet",
        "activity",
        "audit",
      ]) {
        await page.goto(`${baseURL}/#/${route}`);
        await page
          .locator(route === "home" ? "#landing" : `#page-${route}`)
          .waitFor({ state: "visible" });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `${output}/${size}-${theme}-${route}.png`,
          fullPage: true,
        });
      }
      await page.goto(`${baseURL}/`);
      await page.locator("#hero-art-button").click();
      await page.screenshot({
        path: `${output}/${size}-${theme}-room.png`,
        fullPage: false,
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
