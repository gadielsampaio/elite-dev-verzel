import { token, user } from "./support/api";
import { test, expect } from "@playwright/test";
const lotId = "22222222-2222-4222-8222-222222222222";
const result = {
  lotId,
  title: "Settled museum artwork",
  currency: "USD",
  status: "settled",
  endTime: "2026-01-01T12:00:00Z",
  items: [],
  receipt: {
    id: "receipt-id",
    amount: "9007199254740993.01",
    winnerAlias: "bidder_private_alias",
    winningBidId: "bid-id",
    endedAt: "2026-01-01T12:00:00Z",
    settledAt: "2026-01-01T12:00:10Z",
  },
};
test("authorized receipt works and preserves exact amounts on reload", async ({
  page,
}) => {
  await page.route("**/api/lots/**", (route) => {
    expect(route.request().url()).toContain(`/lots/${lotId}/receipt`);
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    return route.fulfill({ json: result });
  });
  await page.goto(`/#/receipt/${lotId}`);
  await expect(
    page.getByRole("heading", { name: "SETTLED RECEIPT" }),
  ).toBeVisible();
  await expect(page.getByText("$9,007,199,254,740,993.01")).toBeVisible();
  await expect(page.getByText("bidder_private_alias")).toBeVisible();
  const url = await page.getByLabel("SHAREABLE AUDIT REPORT LINK").inputValue();
  expect(url).toBe(`${new URL(page.url()).origin}/#/audit/${lotId}`);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "SETTLED RECEIPT" }),
  ).toBeVisible();
});
test("pending settlement refreshes into a receipt without inventing a winner", async ({
  page,
}) => {
  let ready = false;
  await page.route("**/api/lots/**", (route) =>
    route.fulfill({
      json: ready
        ? result
        : { ...result, status: "pending_settlement", receipt: null },
    }),
  );
  await page.goto(`/#/receipt/${lotId}`);
  await expect(
    page.getByText("Settlement is pending.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("SHAREABLE AUDIT REPORT LINK")).toHaveCount(0);
  ready = true;
  await page.getByRole("button", { name: "Refresh result" }).click();
  await expect(
    page.getByRole("heading", { name: "SETTLED RECEIPT" }),
  ).toBeVisible();
});
test("no winner and missing results have explicit states", async ({ page }) => {
  let missing = false;
  await page.route("**/api/lots/**", (route) =>
    route.fulfill(
      missing
        ? { status: 404, json: { message: "Lot not found" } }
        : { json: { ...result, status: "no_winner", receipt: null } },
    ),
  );
  await page.goto(`/#/receipt/${lotId}`);
  await expect(
    page.getByText("Closed without a winner.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("SHAREABLE AUDIT REPORT LINK")).toHaveCount(0);
  missing = true;
  await page.getByRole("button", { name: "Refresh result" }).click();
  await expect(page.getByRole("alert")).toHaveText("Lot not found");
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/refresh", (r) =>
    r.fulfill({ json: { accessToken: token } }),
  );
  await page.route(`**/api/users/${user.id}`, (r) => r.fulfill({ json: user }));
});

test("copy link, public audit navigation and mobile layout use the new pages", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
    }),
  );
  await page.route("**/api/lots/**", (r) => r.fulfill({ json: result }));
  await page.goto(`/#/receipt/${lotId}`);
  await expect(
    page.getByRole("heading", { name: "Settled receipt", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Copy audit report link", exact: true })
    .click();
  await expect(
    page.getByText("Audit report link copied", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { copied: string }).copied),
  ).toBe(await page.getByLabel("Shareable audit report link").inputValue());
  await expect(
    page.getByRole("link", { name: "Verify bid history", exact: true }),
  ).toHaveAttribute("href", `/#/audit/${lotId}`);
  await page.screenshot({
    path: "/tmp/receipt-new-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("copy failure retains manual link and shows an alert", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("Denied");
        },
      },
    }),
  );
  await page.route("**/api/lots/**", (r) => r.fulfill({ json: result }));
  await page.goto(`/#/receipt/${lotId}`);
  await page
    .getByRole("button", { name: "Copy audit report link", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not copy the link",
  );
  await expect(page.getByLabel("Shareable audit report link")).toHaveValue(
    /\/#\/audit\//,
  );
});
test("unended auction and incomplete receipt never display a confirmed receipt", async ({
  page,
}) => {
  let status = "awaiting_close";
  await page.route("**/api/lots/**", (r) =>
    r.fulfill({ json: { ...result, status, receipt: null } }),
  );
  await page.goto(`/#/receipt/${lotId}`);
  await expect(page.getByRole("status")).toContainText(
    "This auction has not ended",
  );
  await expect(page.getByLabel("Shareable audit report link")).toHaveCount(0);
  status = "settled";
  await page
    .getByRole("button", { name: "Refresh result", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Receipt details are unavailable",
  );
  await expect(
    page.getByRole("heading", { name: "Settled receipt", exact: true }),
  ).toHaveCount(0);
});

test("guest cannot request a receipt; other authenticated bidders see forbidden", async ({
  page,
}) => {
  await page.route("**/api/auth/refresh", (r) =>
    r.fulfill({ status: 401, json: { message: "Unauthorized" } }),
  );
  let requests = 0;
  await page.route("**/api/lots/**/receipt", (r) => {
    requests++;
    return r.fulfill({
      status: 403,
      json: {
        message: "Receipt is restricted to the winning bidder and lot owner",
      },
    });
  });
  await page.goto(`/#/receipt/${lotId}`);
  await expect(page.getByRole("alert")).toContainText(
    "Sign in as the winning bidder",
  );
  expect(requests).toBe(0);
  await page.route("**/api/auth/refresh", (r) =>
    r.fulfill({ json: { accessToken: token } }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Receipt is restricted");
  await expect(page.getByLabel("Shareable audit report link")).toHaveCount(0);
});

test("receipt login returns to the protected receipt", async ({ page }) => {
  await page.route("**/api/auth/refresh", (r) =>
    r.fulfill({ status: 401, json: { message: "Unauthorized" } }),
  );
  await page.route("**/api/auth/login", (r) =>
    r.fulfill({ json: { accessToken: token } }),
  );
  await page.route("**/api/lots/**/receipt", (r) => {
    expect(r.request().headers().authorization).toBe(`Bearer ${token}`);
    return r.fulfill({ json: result });
  });
  await page.goto(`/#/receipt/${lotId}`);
  await page
    .getByRole("alert")
    .getByRole("link", { name: "Log in", exact: true })
    .click();
  await page.getByLabel("EMAIL ADDRESS").fill("bidder@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#shadcn-login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#/receipt/${lotId}$`));
  await expect(
    page.getByRole("heading", { name: "Settled receipt", exact: true }),
  ).toBeVisible();
});
