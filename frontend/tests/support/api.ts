import { expect, type Page } from "@playwright/test";
export const user = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test Bidder",
  role: "bidder",
};
export const token =
  "x." +
  Buffer.from(JSON.stringify({ sub: user.id })).toString("base64url") +
  ".x";
export const lot = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Sunday afternoon",
  status: "scheduled",
  currency: "USD",
  startingBid: "100.00",
  bidIncrement: "5.00",
  startTime: "2027-01-01T18:00:00Z",
  endTime: "2027-01-01T19:00:00Z",
  items: [
    {
      id: "item1",
      name: "Painting",
      imageUrl: null,
      artistDisplay: "Georges Seurat",
      sourceSnapshot: { provider: "mock", mediumDisplay: "Oil on canvas" },
    },
  ],
};
export async function setup(
  page: Page,
  { failFirst = false, role = "bidder", failBalanceAfterDeposit = false } = {},
) {
  const deposits: { amount: string; idempotencyKey: string }[] = [];
  let deposited = false;
  let filters: string[] = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    let body: unknown;
    let status = 200;
    if (url.pathname === "/api/auth/login") body = { accessToken: token };
    else if (url.pathname === "/api/auth/register") {
      body = user;
      status = 201;
    } else if (url.pathname === `/api/users/${user.id}`)
      body = { ...user, role };
    else if (url.pathname === "/api/lots") {
      filters.push(url.searchParams.get("status") ?? "");
      body = { items: [lot], page: 1, limit: 9, total: 1 };
    } else if (url.pathname === `/api/lots/${lot.id}`) body = lot;
    else if (url.pathname === "/api/wallet") {
      expect(req.headers().authorization).toBe(`Bearer ${token}`);
      if (deposited && failBalanceAfterDeposit) {
        status = 503;
        body = { message: "Unavailable" };
      } else
        body = {
          walletId: "wallet1",
          currency: "USD",
          total: deposited ? "150.00" : "100.00",
          committed: "20.00",
          available: deposited ? "130.00" : "80.00",
        };
    } else if (url.pathname === "/api/wallet/deposits") {
      expect(req.headers().authorization).toBe(`Bearer ${token}`);
      deposits.push(req.postDataJSON());
      if (failFirst && deposits.length === 1) {
        await route.abort();
        return;
      }
      deposited = true;
      status = 201;
      body = { id: "deposit1", amount: "50.00" };
    } else {
      status = 404;
      body = { message: "Not found" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return { deposits, filters };
}
export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("bidder@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("USD 80.00")).toBeVisible();
}
