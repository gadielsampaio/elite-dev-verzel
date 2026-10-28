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
  await page.route("**/api/**", (route) => {
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
  await page.route("**/api/**", (route) => route.fulfill({ json: data }));
  await page.goto(`/#/audit/${lotId}`);
  await expect(page.getByRole("status")).toHaveText("TAMPERED");
});
test("pending verification refreshes into verified history", async ({
  page,
}) => {
  let pending = true;
  await page.route("**/api/**", (route) =>
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
  await page.getByRole("button", { name: "REFRESH VERIFICATION" }).click();
  await expect(page.getByRole("status")).toHaveText("INTACT");
});
test("database tampering is not overridden by a matching browser hash", async ({
  page,
}) => {
  await page.route("**/api/**", (route) =>
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
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 503, json: { message: "Audit unavailable" } }),
  );
  await page.goto("/#/audit");
  await page.getByLabel("LOT ID").fill(lotId);
  await page.getByRole("button", { name: "VERIFY HISTORY" }).click();
  await expect(page.getByRole("alert")).toHaveText("Audit unavailable");
  await expect(
    page.getByRole("heading", { name: "INTACT", exact: true }),
  ).toHaveCount(0);
});
