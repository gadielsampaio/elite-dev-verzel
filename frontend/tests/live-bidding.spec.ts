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
  test.setTimeout(120000);
  process.loadEnvFile(new URL("../../backend/.env", import.meta.url));
  expect(["localhost", "127.0.0.1"]).toContain(
    new URL(process.env.DATABASE_URL!).hostname,
  );
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
      .locator("#shadcn-login-form")
      .getByRole("button", { name: "LOG IN", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Sign out", exact: true }),
    ).toBeVisible();
  }
  async function open(page: Page) {
    await page.evaluate(() => {
      location.hash = "/";
    });
    await page
      .getByRole("link", { name: `View ${title}`, exact: true })
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
    await sellerPage.getByRole("tab", { name: "Create a lot" }).click();
    await expect(
      sellerPage.getByRole("combobox", { name: "Artwork type" }),
    ).toContainText("Paintings");
    await sellerPage
      .getByRole("button", { name: /^Select / })
      .first()
      .click();
    await sellerPage.getByLabel("Lot title").fill(title);
    await expect(
      sellerPage.getByRole("combobox", { name: "Publication" }),
    ).toContainText("Publish now");
    await sellerPage.getByLabel("Starting bid (USD)").fill("100.00");
    await sellerPage.getByLabel("Minimum increment (USD)").fill("5.00");
    await sellerPage.getByLabel("Estimated value (USD)").fill("500.00");
    await expect(sellerPage.getByLabel("Minimum increment (USD)")).toHaveValue(
      "$5.00",
    );
    await expect(sellerPage.locator("form input:invalid")).toHaveCount(0);
    const publication = sellerPage.waitForResponse(
      (r) => r.url().endsWith("/api/lots") && r.request().method() === "POST",
      { timeout: 15000 },
    );
    await sellerPage
      .getByRole("button", { name: "PUBLISH LOT", exact: true })
      .click();
    const published = await publication;
    expect(published.status()).toBe(201);
    const lot = await published.json();
    expect(lot.status).toBe("open");
    await sellerPage
      .getByRole("dialog")
      .getByRole("button", { name: "My lots", exact: true })
      .click();
    const pageA = await contexts[1].newPage(),
      pageB = await contexts[2].newPage();
    for (const [page, email] of [
      [pageA, a],
      [pageB, b],
    ] as const) {
      await login(page, email);
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "WALLET", exact: true })
        .click();
      await page.getByLabel("Deposit amount (USD)").fill("500.00");
      await page
        .getByRole("button", { name: "Simulate deposit", exact: true })
        .click();
      await expect(
        page.getByText("Deposit recorded", { exact: true }),
      ).toBeVisible();
      await open(page);
      await expect(
        page.getByText("Live updates connected", { exact: true }),
      ).toBeVisible();
    }
    await pageB.getByLabel("Bid amount (USD)").fill("105.00");
    await pageA.getByLabel("Bid amount (USD)").fill("100.00");
    await pageA.getByRole("button", { name: "Place bid", exact: true }).click();
    await pageA.getByRole("tab", { name: "History", exact: true }).click();
    await expect(pageA.getByText("You", { exact: true })).toBeVisible();
    await pageA.getByRole("tab", { name: "Bid", exact: true }).click();
    await expect(
      pageA.getByText("You are currently leading", { exact: false }),
    ).toBeVisible();

    await pageB.getByRole("tab", { name: "History", exact: true }).click();
    await expect(pageB.getByText("Bidder A", { exact: true })).toBeVisible();
    await pageB.getByRole("tab", { name: "Bid", exact: true }).click();
    await expect(pageB.getByLabel("Bid amount (USD)")).toHaveValue("$105.00");
    await contexts[1].setOffline(true);
    await expect(
      pageA.getByText("Connecting live updates · Automatic refresh active", {
        exact: true,
      }),
    ).toBeVisible();
    await pageB.getByRole("button", { name: "Place bid", exact: true }).click();
    await expect(
      pageB.getByText("You are currently leading", { exact: false }),
    ).toBeVisible();

    await contexts[1].setOffline(false);
    await expect(
      pageA.getByText("Live updates connected", { exact: true }),
    ).toBeVisible();
    await expect(
      pageA.getByText("You have been outbid", { exact: false }),
    ).toBeVisible();
    await pageA.getByRole("tab", { name: "History", exact: true }).click();
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
          .locator('dl[aria-label="Wallet balances"] > div')
          .filter({ hasText: "Committed balance" })
          .locator("dd"),
      ).toHaveText(committed);
      await expect(
        page
          .locator('dl[aria-label="Wallet balances"] > div')
          .filter({ hasText: "Available balance" })
          .locator("dd"),
      ).toHaveText(available);
    }

    await open(pageA);
    await expect(
      pageA.getByText("Live updates connected", { exact: true }),
    ).toBeVisible();
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

    await expect(
      pageA.getByText("You did not win this auction. Settlement is complete."),
    ).toBeVisible();
    await pageA.getByRole("button", { name: "Close artwork room" }).click();
    await pageB.getByRole("button", { name: "Refresh balance" }).click();
    await expect(
      pageB
        .locator('dl[aria-label="Wallet balances"] > div')
        .filter({ hasText: "Committed balance" })
        .locator("dd"),
    ).toHaveText("$0.00");
    await expect(
      pageB
        .locator('dl[aria-label="Wallet balances"] > div')
        .filter({ hasText: "Total balance" })
        .locator("dd"),
    ).toHaveText("$395.00");

    await expect(
      sellerPage
        .locator("dl > div")
        .filter({ hasText: "Total received" })
        .locator("dd"),
    ).toHaveText("$105.00");
    await expect(
      sellerPage
        .locator("dl > div")
        .filter({ hasText: "Lots sold" })
        .locator("dd"),
    ).toHaveText("1");
    await sellerPage.getByRole("tab", { name: "Results", exact: true }).click();
    await expect(
      sellerPage.getByText("Sold · Settled", { exact: true }),
    ).toBeVisible();
    await sellerPage.screenshot({
      path: "/tmp/haus-seller-settled.png",
      fullPage: true,
    });

    await pageB
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "MY BIDS", exact: true })
      .click();
    await pageB.getByRole("tab", { name: "My wins", exact: true }).click();
    await expect(
      pageB.getByText("Won · Settled", { exact: true }),
    ).toBeVisible();
    await pageB.screenshot({ path: "/tmp/haus-winner.png", fullPage: true });
    await pageB.getByRole("link", { name: "Result/Receipt" }).click();
    await expect(
      pageB.getByRole("heading", { name: "Settled receipt" }),
    ).toBeVisible();
    const auditUrl = await pageB
      .getByLabel("Shareable audit report link")
      .inputValue();
    const guest = await browser.newContext();
    contexts.push(guest);
    const guestPage = await guest.newPage();
    await guestPage.goto(auditUrl);
    await expect(
      guestPage.getByRole("heading", { name: "Public audit", exact: true }),
    ).toBeVisible();
    const denied = await request.get(`/api/lots/${lot.id}/receipt`);
    expect(denied.status()).toBe(401);
    await pageA.goto(`/#/receipt/${lot.id}`);
    await expect(pageA.getByRole("alert")).toContainText(
      /receipt|winner|auctioneer/i,
    );
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
    await guestPage.goto(`/#/audit/${lot.id}`);
    await expect(guestPage.getByRole("status")).toHaveText("INTACT");
    await expect(guestPage.locator("tbody tr")).toHaveCount(2);
    await expect(guestPage.locator("body")).not.toContainText(b);
    await pageA
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "MY BIDS", exact: true })
      .click();
    await expect(
      pageA.getByText("Not won · Settled", { exact: true }),
    ).toBeVisible();
    await pageA.getByRole("tab", { name: "My wins", exact: true }).click();
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
