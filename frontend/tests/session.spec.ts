import { test, expect, type Page } from "@playwright/test";
import { setup, user, lot, token } from "./support/api";
const key = "auction-session-token";
async function login(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("seller@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#shadcn-login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}
test("reload restores a verified seller session and sign out clears it", async ({
  page,
}) => {
  await setup(page, { role: "auctioneer" });
  await page.route("**/api/lots/mine?**", (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, limit: 9 } }),
  );
  let profiles = 0;
  await page.route(`**/api/users/${user.id}`, (route) => {
    profiles++;
    return route.fulfill({ json: { ...user, role: "auctioneer" } });
  });
  await login(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "SELLER STUDIO" })
    .click();
  const beforeReload = profiles;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "YOUR COLLECTION" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/seller$/);
  expect(profiles).toBeGreaterThan(beforeReload);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toHaveCount(0);
});
test("server rejection during restore clears stored credentials", async ({
  page,
}) => {
  await setup(page);
  await login(page);
  await page.route(`**/api/users/${user.id}`, (route) =>
    route.fulfill({ status: 401, json: { message: "Unauthorized" } }),
  );
  await page.reload();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("status")).toContainText("session expired");
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
});
test("temporary restore failure keeps the token and supports retry", async ({
  page,
}) => {
  await setup(page);
  await login(page);
  let fail = true;
  await page.route(`**/api/users/${user.id}`, (route) =>
    route.fulfill(
      fail ? { status: 503, json: { message: "Unavailable" } } : { json: user },
    ),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Could not restore");
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
  fail = false;
  await page.getByRole("button", { name: "RETRY", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
});
test("removes legacy storage tokens and restores using the refresh cookie", async ({
  page,
}) => {
  await setup(page);
  await login(page);
  await page.evaluate(
    (key) => sessionStorage.setItem(key, "legacy-token"),
    key,
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
});

test("renews before access-token expiry without logging out", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install();
  await login(page);
  const renewed =
    "x." +
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".x";
  await page.route("**/api/wallet", (route) =>
    route.fulfill({
      json: {
        walletId: "wallet1",
        currency: "USD",
        total: "100.00",
        committed: "0.00",
        available: "100.00",
      },
    }),
  );
  let rotations = 0;
  await page.route("**/api/auth/refresh", (route) => {
    rotations++;
    return route.fulfill({ json: { accessToken: renewed } });
  });
  await page.clock.fastForward(850000);
  await expect.poll(() => rotations).toBe(1);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain(renewed);
});

test("expired refresh token requires login", async ({ page }) => {
  await setup(page);
  await page.clock.install();
  await login(page);
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "Refresh session expired" },
    }),
  );
  await page.clock.fastForward(850000);
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("status")).toContainText("session expired");
});

test("concurrent unauthorized requests share one refresh and retry with the new token", async ({
  page,
}) => {
  await setup(page, { role: "auctioneer" });
  await login(page);
  const renewed =
    "x." +
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".x";
  let rotations = 0;
  await page.route("**/api/auth/refresh", async (route) => {
    rotations++;
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ json: { accessToken: renewed } });
  });
  await page.route("**/api/me/auction-summary", (route) =>
    route.fulfill(
      route.request().headers().authorization === `Bearer ${renewed}`
        ? {
            json: {
              lots: 0,
              live: 0,
              sold: 0,
              currency: "USD",
              totalReceived: "0.00",
            },
          }
        : { status: 401, json: { message: "Expired" } },
    ),
  );
  await page.route("**/api/lots/mine?**", (route) =>
    route.fulfill(
      route.request().headers().authorization === `Bearer ${renewed}`
        ? { json: { items: [], total: 0, page: 1, limit: 9 } }
        : { status: 401, json: { message: "Expired" } },
    ),
  );
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "SELLER STUDIO" })
    .click();
  await expect(page.getByText("No lots yet.", { exact: false })).toBeVisible();
  expect(rotations).toBe(1);
});

for (const destination of ["lot", "receipt"] as const) {
  test(`session expiry preserves the ${destination} return destination`, async ({
    page,
  }) => {
    await setup(page);
    await login(page);
    await page.evaluate(
      ({ destination, id }) => {
        location.hash = `/${destination}/${id}`;
      },
      { destination, id: lot.id },
    );
    await expect(page).toHaveURL(new RegExp(`#/${destination}/${lot.id}$`));
    await expect(
      page.getByRole("heading", {
        name: destination === "lot" ? lot.title : "Receipt",
        level: destination === "lot" ? 2 : 1,
        exact: true,
      }),
    ).toBeVisible();

    await page.evaluate((accessToken) => {
      window.dispatchEvent(
        new CustomEvent("session-expired", { detail: accessToken }),
      );
    }, token);
    await expect(page).toHaveURL(
      new RegExp(`#/login\\?${destination}=${lot.id}$`),
    );
    await page.getByLabel("EMAIL ADDRESS").fill("bidder@example.com");
    await page
      .getByLabel("PASSWORD", { exact: true })
      .fill("test-password-123");
    await page
      .locator("#shadcn-login-form")
      .getByRole("button", { name: "LOG IN", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`#/${destination}/${lot.id}$`));
    await expect(
      page.getByRole("heading", {
        name: destination === "lot" ? lot.title : "Receipt",
        level: destination === "lot" ? 2 : 1,
        exact: true,
      }),
    ).toBeVisible();
  });
}

test("sign out clears the session in another open tab", async ({
  page,
  context,
}) => {
  await setup(page);
  await login(page);
  const otherTab = await context.newPage();
  await setup(otherTab);
  await login(otherTab);

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toHaveCount(0);
  await expect(
    otherTab.getByRole("button", { name: "Sign out", exact: true }),
  ).toHaveCount(0);
  await expect(
    otherTab.getByRole("link", { name: "LOG IN", exact: true }).first(),
  ).toBeVisible();
});

test("temporary renewal failure retries without clearing the session", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install();
  await login(page);
  const renewed =
    "x." +
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".x";
  let rotations = 0;
  let unavailable = true;
  await page.route("**/api/auth/refresh", (route) => {
    rotations++;
    return route.fulfill(
      unavailable
        ? { status: 503, json: { message: "Unavailable" } }
        : { json: { accessToken: renewed } },
    );
  });

  await page.clock.fastForward(850000);
  await expect(
    page.getByRole("alert").filter({ hasText: "Session renewal unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  expect(rotations).toBe(1);

  unavailable = false;
  await page.clock.fastForward(30000);
  await expect.poll(() => rotations).toBe(2);
  await expect(
    page.getByText("Session renewal unavailable", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
});

test("renewal cannot replay a request under a different account", async ({
  page,
}) => {
  await setup(page, { role: "auctioneer" });
  await login(page);
  const otherId = "44444444-4444-4444-8444-444444444444";
  const otherToken =
    "x." +
    Buffer.from(
      JSON.stringify({
        sub: otherId,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".x";
  const authorizations: (string | undefined)[] = [];
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ json: { accessToken: otherToken } }),
  );
  await page.route(`**/api/users/${otherId}`, (route) =>
    route.fulfill({ json: { ...user, id: otherId, name: "Other account" } }),
  );
  for (const path of ["**/api/me/auction-summary", "**/api/lots/mine?**"]) {
    await page.route(path, (route) => {
      authorizations.push(route.request().headers().authorization);
      return route.fulfill({ status: 401, json: { message: "Expired" } });
    });
  }

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "SELLER STUDIO" })
    .click();
  await expect(page).toHaveURL(/#\/login$/);
  await expect(page.getByRole("status")).toContainText("session expired");
  expect(authorizations.length).toBeGreaterThan(0);
  expect(authorizations.every((value) => value === `Bearer ${token}`)).toBe(
    true,
  );
  await expect(page.getByText("Other account", { exact: false })).toHaveCount(
    0,
  );
});

for (const [theme, width] of [
  ["light", 1440],
  ["dark", 390],
] as const) {
  test(`session recovery uses the application layout in ${theme} mode`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((theme) => {
      localStorage.setItem("haus-sampaio-theme", theme);
    }, theme);
    await setup(page);
    let unavailable = true;
    let walletRequests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/wallet") walletRequests++;
    });
    await page.route("**/api/auth/refresh", (route) =>
      route.fulfill(
        unavailable
          ? { status: 503, json: { message: "Unavailable" } }
          : { json: { accessToken: token } },
      ),
    );
    await page.goto("/#/wallet");

    await expect(
      page.getByRole("heading", { name: "Session unavailable" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      theme === "dark" ? "rgb(26, 26, 26)" : "rgb(245, 239, 227)",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(walletRequests).toBe(0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `/tmp/elite-session-recovery-${theme}.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: "PT", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
    unavailable = false;
    await page
      .getByRole("button", { name: "TENTAR NOVAMENTE", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Minha carteira", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect.poll(() => walletRequests).toBeGreaterThan(0);
  });
}

test("failed sign out during recovery stays visible and can be retried", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ status: 503, json: { message: "Unavailable" } }),
  );
  let unavailable = true;
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill(
      unavailable
        ? { status: 503, json: { message: "Unavailable" } }
        : { status: 204, body: "" },
    ),
  );
  await page.goto("/#/wallet");
  await page.getByRole("button", { name: "SIGN OUT", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Session unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not sign out" }),
  ).toBeVisible();

  unavailable = false;
  await page.getByRole("button", { name: "SIGN OUT", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My wallet", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Sign in to view your wallet.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Session unavailable" }),
  ).toHaveCount(0);
});
