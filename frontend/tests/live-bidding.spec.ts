import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Opt-in only: real local API, Cleveland, PostgreSQL and isolated browser sessions.
test("live publication, bidding, settlement and account results journey", async ({
  browser,
  request,
}) => {
  test.skip(
    process.env.RUN_LIVE_TESTS !== "1",
    "Requires local API/database and Cleveland",
  );
  test.setTimeout(90000);
  process.loadEnvFile(new URL("../../backend/.env", import.meta.url));
  expect(
    process.env.AUDIT_CHECKPOINT_DIR,
    "Configure external audit storage before this live test",
  ).toBeTruthy();
  const require = createRequire(
    new URL("../../backend/package.json", import.meta.url),
  );
  const { Pool } = require("pg");
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  const userIds: string[] = [];
  const contexts = [];
  const suffix = randomUUID(),
    password = "Live-test-password-123!";
  const title = `Live browser check ${suffix}`;
  async function register(role: string) {
    const email = `live-${role}-${randomUUID()}@example.invalid`;
    const response = await request.post("/api/auth/register", {
      data: { name: "Live verification", email, password, role },
    });
    expect(response.status()).toBe(201);
    const user = await response.json();
    userIds.push(user.id);
    return email;
  }
  async function login(page: Page, email: string) {
    await page.goto("/#/login");
    await page.getByLabel("EMAIL ADDRESS").fill(email);
    await page.getByLabel("PASSWORD", { exact: true }).fill(password);
    await page
      .locator("#login-form")
      .getByRole("button", { name: "LOG IN", exact: true })
      .click();
    await expect(page.locator(".hs-wallet-grid")).toBeVisible();
  }
  async function open(page: Page) {
    await page.evaluate(() => {
      location.hash = "/";
    });
    await page
      .getByRole("button", { name: `View ${title}`, exact: true })
      .click();
  }
  try {
    const seller = await register("auctioneer");
    const a = await register("bidder"),
      b = await register("bidder");
    for (let i = 0; i < 3; i++) contexts.push(await browser.newContext());
    const sellerPage = await contexts[0].newPage();
    await login(sellerPage, seller);
    await sellerPage.evaluate(() => {
      location.hash = "/seller";
    });
    await sellerPage.getByRole("tab", { name: "CREATE A LOT" }).click();
    await sellerPage
      .getByLabel("ARTWORK TYPE", { exact: true })
      .selectOption("Painting");
    await sellerPage
      .getByRole("button", { name: "SEARCH", exact: true })
      .click();
    await sellerPage.locator(".hs-seller-art-card").first().click();
    await sellerPage.getByLabel("LOT TITLE").fill(title);
    await sellerPage.getByLabel("PUBLICATION").selectOption("now");
    await sellerPage.getByLabel("STARTING BID (USD)").fill("100.00");
    await sellerPage.getByLabel("MINIMUM INCREMENT (USD)").fill("5.00");
    await sellerPage.getByLabel("ESTIMATED VALUE (USD)").fill("500.00");
    await expect(sellerPage.getByLabel("MINIMUM INCREMENT (USD)")).toHaveValue(
      "$5.00",
    );
    const publication = sellerPage.waitForResponse(
      (r) => r.url().endsWith("/api/lots") && r.request().method() === "POST",
    );
    await sellerPage
      .getByRole("button", { name: "PUBLISH LOT", exact: true })
      .click();
    const published = await publication;
    expect(published.status()).toBe(201);
    const lot = await published.json();
    expect(lot.status).toBe("open");
    const pageA = await contexts[1].newPage(),
      pageB = await contexts[2].newPage();
    for (const [page, email] of [
      [pageA, a],
      [pageB, b],
    ] as const) {
      await login(page, email);
      await page.getByLabel("DEPOSIT AMOUNT (USD)").fill("500.00");
      await page
        .getByRole("button", { name: "SIMULATE DEPOSIT", exact: true })
        .click();
      await expect(page.getByText("Simulated deposit recorded.")).toBeVisible();
      await open(page);
    }
    await pageA.getByLabel("BID AMOUNT (USD)").fill("100.00");
    await pageA.getByRole("button", { name: "PLACE BID", exact: true }).click();
    await expect(pageA.getByText("You", { exact: true })).toBeVisible();
    await expect(
      pageA.getByText("● YOU ARE CURRENTLY LEADING", { exact: false }),
    ).toBeVisible();
    await pageB
      .getByRole("button", { name: "REFRESH LOT ↻", exact: true })
      .click();
    await expect(pageB.getByText("Bidder A", { exact: true })).toBeVisible();
    await pageB.getByLabel("BID AMOUNT (USD)").fill("105.00");
    await pageB.getByRole("button", { name: "PLACE BID", exact: true }).click();
    await expect(
      pageB.getByText("● YOU ARE CURRENTLY LEADING", { exact: false }),
    ).toBeVisible();
    await pageA
      .getByRole("button", { name: "REFRESH LOT ↻", exact: true })
      .click();
    await expect(
      pageA.getByText("● YOU HAVE BEEN OUTBID", { exact: false }),
    ).toBeVisible();
    await expect(pageA.getByText("Bidder B", { exact: true })).toBeVisible();
    await expect(pageA.getByText("You", { exact: true })).toBeVisible();
    for (const [page, committed, available] of [
      [pageA, "$0.00", "$500.00"],
      [pageB, "$105.00", "$395.00"],
    ] as const) {
      await page.getByRole("button", { name: "Close artwork room" }).click();
      await page.evaluate(() => {
        location.hash = "/wallet";
      });
      await expect(
        page
          .locator(".hs-wallet-grid > div")
          .filter({ hasText: "COMMITTED BALANCE" })
          .locator("strong"),
      ).toHaveText(committed);
      await expect(
        page
          .locator(".hs-wallet-grid > div")
          .filter({ hasText: "AVAILABLE BALANCE" })
          .locator("strong"),
      ).toHaveText(available);
    }

    // Advance only this test-owned lot's deadline; let the real background worker settle it.
    const expired = await db.query(
      "UPDATE lots SET end_time = now() - interval '1 second' WHERE id = $1 AND owner_id = $2 AND title = $3",
      [lot.id, userIds[0], title],
    );
    expect(expired.rowCount).toBe(1);
    await expect
      .poll(
        async () => {
          const response = await request.get(`/api/lots/${lot.id}/result`);
          expect(response.ok()).toBe(true);
          return (await response.json()).status;
        },
        { timeout: 25000, intervals: [1000] },
      )
      .toBe("settled");

    await pageB.getByRole("button", { name: "REFRESH BALANCE" }).click();
    await expect(
      pageB
        .locator(".hs-wallet-grid > div")
        .filter({ hasText: "COMMITTED BALANCE" })
        .locator("strong"),
    ).toHaveText("$0.00");
    await expect(
      pageB
        .locator(".hs-wallet-grid > div")
        .filter({ hasText: "TOTAL BALANCE" })
        .locator("strong"),
    ).toHaveText("$395.00");

    await sellerPage.getByRole("button", { name: "REFRESH SUMMARY" }).click();
    await expect(
      sellerPage
        .locator(".hs-seller-stats > div")
        .filter({ hasText: "TOTAL RECEIVED" })
        .locator("strong"),
    ).toHaveText("$105.00");
    await expect(
      sellerPage
        .locator(".hs-seller-stats > div")
        .filter({ hasText: "LOTS SOLD" })
        .locator("strong"),
    ).toHaveText("1");
    await sellerPage.getByRole("tab", { name: "RESULTS", exact: true }).click();
    await expect(
      sellerPage.getByText("SOLD · SETTLED", { exact: true }),
    ).toBeVisible();
    await sellerPage.screenshot({
      path: "/tmp/haus-seller-settled.png",
      fullPage: true,
    });

    await pageB.getByRole("button", { name: "MY BIDS", exact: true }).click();
    await pageB.getByRole("tab", { name: "MY WINS", exact: true }).click();
    await expect(
      pageB.getByText("WON · SETTLED", { exact: true }),
    ).toBeVisible();
    await pageB.screenshot({ path: "/tmp/haus-winner.png", fullPage: true });
    await pageB.getByRole("link", { name: "VIEW / SHARE RECEIPT ↗" }).click();
    await expect(
      pageB.getByRole("heading", { name: "SETTLED RECEIPT" }),
    ).toBeVisible();
    const receiptUrl = await pageB
      .getByLabel("SHAREABLE RECEIPT LINK")
      .inputValue();
    const guest = await browser.newContext();
    contexts.push(guest);
    const guestPage = await guest.newPage();
    await guestPage.goto(receiptUrl);
    await expect(
      guestPage.getByRole("heading", { name: "SETTLED RECEIPT" }),
    ).toBeVisible();
    await expect(guestPage.getByText("$105.00", { exact: true })).toBeVisible();
    await expect(guestPage.locator("body")).not.toContainText(b);
    await expect
      .poll(
        async () => {
          const response = await request.get(`/api/lots/${lot.id}/audit`);
          expect(response.status()).toBe(200);
          return (await response.json()).status;
        },
        { timeout: 15000 },
      )
      .toBe("intact");
    await guestPage.getByRole("link", { name: "VERIFY BID HISTORY" }).click();
    await expect(guestPage.getByRole("status")).toHaveText("INTACT");
    await expect(guestPage.getByRole("listitem")).toHaveCount(2);
    await expect(guestPage.locator("body")).not.toContainText(b);
    await pageA.getByRole("button", { name: "MY BIDS", exact: true }).click();
    await expect(
      pageA.getByText("NOT WON · SETTLED", { exact: true }),
    ).toBeVisible();
    await pageA.getByRole("tab", { name: "MY WINS", exact: true }).click();
    await expect(pageA.getByText("No confirmed wins yet.")).toBeVisible();
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      // Only test-owned records; never reset tables or remove existing user data.
      const own = [userIds];
      const ownedLots = await client.query(
        "SELECT id FROM lots WHERE owner_id = ANY($1::uuid[])",
        own,
      );
      await client.query(
        "DELETE FROM wallet_holds WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id = ANY($1::uuid[]))",
        own,
      );
      await client.query(
        "DELETE FROM wallet_transactions WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id = ANY($1::uuid[]))",
        own,
      );
      await client.query(
        "DELETE FROM auction_results WHERE owner_id = ANY($1::uuid[])",
        own,
      );
      await client.query(
        "DELETE FROM bids WHERE bidder_id = ANY($1::uuid[])",
        own,
      );
      await client.query(
        "DELETE FROM items WHERE lot_id IN (SELECT id FROM lots WHERE owner_id = ANY($1::uuid[]))",
        own,
      );
      await client.query(
        "DELETE FROM lots WHERE owner_id = ANY($1::uuid[])",
        own,
      );
      await client.query(
        "DELETE FROM wallets WHERE user_id = ANY($1::uuid[])",
        own,
      );
      await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", own);
      await client.query("COMMIT");
      // Remove only checkpoints belonging to this test's random, isolated users.
      for (const row of ownedLots.rows as { id: string }[]) {
        await rm(join(process.env.AUDIT_CHECKPOINT_DIR!, row.id), {
          recursive: true,
          force: true,
        });
      }
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
      await db.end();
    }
  }
});
