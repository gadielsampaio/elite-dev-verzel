import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
const requireBackend = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
const { Pool } = requireBackend("pg");
test("real local HttpOnly cookie rotates on reload and is revoked on logout", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.RUN_LIVE_TESTS !== "1",
    "Opt-in local API/PostgreSQL test",
  );
  const env = parseEnv(
    readFileSync(new URL("../../backend/.env", import.meta.url), "utf8"),
  );
  const connection = new URL(env.DATABASE_URL);
  if (!["localhost", "127.0.0.1"].includes(connection.hostname))
    throw new Error("This test requires a local database");
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const email = `refresh-live-${randomUUID()}@example.invalid`,
    password = `Test-${randomUUID()}`;
  let userId: string | undefined;
  try {
    const registered = await request.post("/api/auth/register", {
      data: { name: "Refresh live fixture", email, password, role: "bidder" },
    });
    expect(registered.status()).toBe(201);
    userId = (await registered.json()).id;
    await page.goto("/#/login");
    await page.getByLabel("EMAIL ADDRESS").fill(email);
    await page.getByLabel("PASSWORD", { exact: true }).fill(password);
    await page
      .locator("#login-form")
      .getByRole("button", { name: "LOG IN", exact: true })
      .click();
    await expect(page.locator(".hs-wallet-grid")).toBeVisible();
    const first = (await page.context().cookies()).find(
      (c) => c.name === "auction_refresh",
    );
    expect(first?.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      "auction_refresh",
    );
    expect(
      await page.evaluate(() =>
        JSON.stringify({ ...localStorage, ...sessionStorage }),
      ),
    ).not.toContain(first!.value);
    await page.reload();
    await expect(page.locator(".hs-wallet-grid")).toBeVisible();
    const second = (await page.context().cookies()).find(
      (c) => c.name === "auction_refresh",
    );
    expect(second?.value).not.toBe(first?.value);
    expect(
      await pool.query(
        "SELECT count(*)::int AS n FROM refresh_sessions WHERE user_id=$1 AND consumed_at IS NOT NULL",
        [userId],
      ),
    ).toMatchObject({ rows: [{ n: 1 }] });
    await page.getByRole("button", { name: "SIGN OUT", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "SIGN OUT", exact: true }),
    ).toHaveCount(0);
    expect(
      (await page.context().cookies()).some(
        (c) => c.name === "auction_refresh",
      ),
    ).toBe(false);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "SIGN OUT", exact: true }),
    ).toHaveCount(0);
    const active = await pool.query(
      "SELECT count(*)::int AS n FROM refresh_sessions WHERE user_id=$1 AND revoked_at IS NULL",
      [userId],
    );
    expect(active.rows[0].n).toBe(0);
  } finally {
    if (userId)
      await pool.query("DELETE FROM users WHERE id=$1 AND email=$2", [
        userId,
        email,
      ]);
    await pool.end();
  }
});
