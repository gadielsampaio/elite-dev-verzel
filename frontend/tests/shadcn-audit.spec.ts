import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
const lotId = "22222222-2222-4222-8222-222222222222";
function fixture() {
  const entry = {
    lotId,
    sequence: 1,
    previousHash: null,
    bidId: "33333333-3333-4333-8333-333333333333",
    bidderAlias: `bidder_${"a".repeat(32)}`,
    amount: "9007199254740993.01",
    currency: "USD",
    acceptedAt: "2026-10-28T12:00:00.000Z",
    endTime: "2026-10-29T12:00:00.000Z",
    hash: "",
  };
  entry.hash = createHash("sha256")
    .update(
      JSON.stringify([
        "auction-bid-audit-v1",
        lotId,
        1,
        null,
        entry.bidId,
        entry.bidderAlias,
        entry.amount,
        entry.currency,
        entry.acceptedAt,
        entry.endTime,
      ]),
    )
    .digest("hex");
  return {
    lotId,
    title: "Audited artwork",
    status: "intact",
    reason:
      "The complete recorded bid history matches the external checkpoints.",
    checkedAt: entry.acceptedAt,
    entries: [entry],
    checkpoint: { sequence: 1, hash: entry.hash },
    history: [
      {
        bidId: entry.bidId,
        bidderLabel: "Bidder 1",
        amount: entry.amount,
        acceptedAt: entry.acceptedAt,
        covered: true,
      },
    ],
  };
}
test("public audit recomputes hashes logged out, preserves exact money and survives reload", async ({
  page,
}) => {
  await page.route("**/api/lots/**", (route) => {
    expect(route.request().url()).toContain(`/lots/${lotId}/audit`);
    expect(route.request().headers().authorization).toBeUndefined();
    return route.fulfill({ json: fixture() });
  });
  await page.goto(`/#/audit/${lotId}`);
  await expect(page.getByRole("status")).toHaveText("INTACT");
  await expect(
    page.getByText("$9,007,199,254,740,993.01", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Bidder 1", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("INTACT");
});
test("browser rejects a forged intact response with invalid hashes", async ({
  page,
}) => {
  const data = fixture();
  data.entries[0].amount = "1.00";
  await page.route("**/api/lots/**", (route) => route.fulfill({ json: data }));
  await page.goto(`/#/audit/${lotId}`);
  await expect(page.getByRole("status")).toHaveText("TAMPERED");
});
test("pending verification refreshes into verified history", async ({
  page,
}) => {
  let pending = true;
  await page.route("**/api/lots/**", (route) =>
    route.fulfill({
      json: pending
        ? {
            ...fixture(),
            status: "not_verifiable",
            reason: "Checkpoint confirmation is pending.",
          }
        : fixture(),
    }),
  );
  await page.goto(`/#/audit/${lotId}`);
  await expect(page.getByRole("status")).toHaveText("NOT VERIFIABLE");
  pending = false;
  await page.getByRole("button", { name: "Refresh verification" }).click();
  await expect(page.getByRole("status")).toHaveText("INTACT");
});
test("database tampering is not overridden by a matching browser hash", async ({
  page,
}) => {
  await page.route("**/api/lots/**", (route) =>
    route.fulfill({
      json: {
        ...fixture(),
        status: "tampered",
        reason:
          "Bids were inserted or removed outside the checkpointed history.",
      },
    }),
  );
  await page.goto(`/#/audit/${lotId}`);
  await expect(page.getByRole("status")).toHaveText("TAMPERED");
});
test("public audit form and server failure never substitute demo history", async ({
  page,
}) => {
  await page.route("**/api/lots/**", (route) =>
    route.fulfill({ status: 503, json: { message: "Audit unavailable" } }),
  );
  await page.goto("/#/audit");
  await page.getByLabel("LOT ID").fill(lotId);
  await page.getByRole("button", { name: "VERIFY HISTORY" }).click();
  await expect(page.getByRole("alert")).toContainText("Audit unavailable");
  await expect(
    page.getByRole("heading", { name: "INTACT", exact: true }),
  ).toHaveCount(0);
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ status: 401, json: { message: "Unauthorized" } }),
  );
});

test("checkpoint, trust boundary, navigation and mobile history remain accessible", async ({
  page,
}) => {
  await page.route("**/api/lots/**", (r) => r.fulfill({ json: fixture() }));
  await page.goto(`/#/audit/${lotId}`);
  await expect(page.getByRole("status")).toHaveText("INTACT");
  await expect(page.locator('header a[aria-current="page"]')).toHaveText(
    "PUBLIC AUDIT",
  );
  await page
    .getByRole("button", { name: "Audit checkpoint", exact: true })
    .click();
  await expect(
    page.getByText(fixture().checkpoint.hash, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Verification scope", exact: true })
    .click();
  await expect(page.getByText(/administrator who disables/)).toBeVisible();
  await page.screenshot({
    path: "/tmp/public-audit-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator("header")
    .getByRole("link", { name: "PUBLIC AUDIT", exact: true })
    .click();
  await expect(page.getByLabel("Lot ID", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("heading", { name: "Audited artwork", exact: true }),
  ).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("status")).toHaveText("INTACT");
});
test("invalid ID avoids requests and unavailable browser crypto never reports intact", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/lots/**", (r) => {
    calls++;
    return r.fulfill({ json: fixture() });
  });
  await page.addInitScript(() =>
    Object.defineProperty(window.crypto, "subtle", { value: undefined }),
  );
  await page.goto("/#/audit");
  await page.getByLabel("Lot ID", { exact: true }).fill("wrong-id");
  await page
    .getByRole("button", { name: "Verify history", exact: true })
    .click();
  await expect(page.getByText("Enter a valid lot ID (UUID).")).toBeVisible();
  expect(calls).toBe(0);
  await page.getByLabel("Lot ID", { exact: true }).fill(lotId);
  await page
    .getByRole("button", { name: "Verify history", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("NOT VERIFIABLE");
  await expect(
    page.getByText(
      "Browser verification is unavailable. Use HTTPS or localhost.",
    ),
  ).toBeVisible();
});
test("uncovered and empty histories are shown without inventing coverage", async ({
  page,
}) => {
  const data = {
    ...fixture(),
    status: "not_verifiable",
    reason: "Historical bids are outside audit coverage.",
    checkpoint: null,
    entries: [],
    history: [{ ...fixture().history[0], covered: false }],
  };
  await page.route("**/api/lots/**", (r) => r.fulfill({ json: data }));
  await page.goto(`/#/audit/${lotId}`);
  await expect(page.getByRole("status")).toHaveText("NOT VERIFIABLE");
  await expect(
    page.getByText("Outside audit coverage", { exact: true }),
  ).toBeVisible();
  data.history = [];
  await page
    .getByRole("button", { name: "Refresh verification", exact: true })
    .click();
  await expect(page.getByText("No recorded bids.")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("NOT VERIFIABLE");
});


test("public audit lists closed lots with audit links only", async ({ page }) => {
  await page.route("**/api/auth/refresh", r => r.fulfill({ status: 401, json: {} }));
  await page.route("**/api/lots?**", r => {
    const url = new URL(r.request().url());
    expect(url.searchParams.get("status")).toBe("closed");
    expect(r.request().headers().authorization).toBeUndefined();
    return r.fulfill({ json: { items: [{ id: lotId, title: "Closed artwork", items: [{ imageUrl: "/artwork-preview.jpg", artistDisplay: "George Bellows" }], endTime: "2026-01-01T12:00:00Z" }], total: 1, page: 1, limit: 9 } });
  });
  await page.goto("/#/audit");
  const list = page.getByRole("region", { name: "Closed lots" });
  await expect(list.getByText("Closed artwork")).toBeVisible();
  await expect(list.getByText("George Bellows")).toBeVisible();
  await expect(list.getByRole("link", { name: "View audit for Closed artwork" })).toHaveAttribute("href", `/#/audit/${lotId}`);
  await expect(list.getByRole("link", { name: "Verify history" })).toHaveAttribute("href", `/#/audit/${lotId}`);
  await expect(page.locator('a[href*="receipt"]')).toHaveCount(0);
});
