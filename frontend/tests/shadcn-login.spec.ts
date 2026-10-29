import { test, expect } from "@playwright/test";
import { setup, token } from "./support/api";

test("login validates fields, shows server errors, retries and restores session", async ({
  page,
}) => {
  await setup(page);
  let calls = 0;
  await page.route("**/api/auth/login", async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({
      email: "bidder@example.com",
      password: "test-password-123",
    });
    if (calls === 1)
      return route.fulfill({
        status: 401,
        json: { message: "Invalid credentials" },
      });
    // Delegate success to the existing mock, which also enables refresh-cookie restoration.
    await route.fallback();
  });
  const lotRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/lots")
      lotRequests.push(request.url());
  });
  await page.goto("/#/login");
  const form = page.locator("#shadcn-login-form");
  await form.getByRole("button", { name: "LOG IN", exact: true }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByLabel("EMAIL ADDRESS")).toBeFocused();
  expect(calls).toBe(0);
  expect(lotRequests).toEqual([]);
  await page.getByLabel("EMAIL ADDRESS").fill("bidder@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("PASSWORD", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await form.getByRole("button", { name: "LOG IN", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid credentials");
  await expect(
    form.getByRole("button", { name: "LOG IN", exact: true }),
  ).toBeEnabled();
  await form.getByRole("button", { name: "LOG IN", exact: true }).click();
  await expect(
    page.getByText("Test Bidder – Bidder", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#catalog")).toBeVisible();
  expect(calls).toBe(2);
  await page.reload();
  await expect(
    page.getByText("Test Bidder – Bidder", { exact: true }),
  ).toBeVisible();
});

test("pending login is submitted once and mobile dark layout stays usable", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem("haus-sampaio-theme", "dark"),
  );
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("**/api/auth/login", async (route) => {
    calls++;
    await pending;
    await route.fulfill({ json: { accessToken: token } });
  });
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("bidder@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  const form = page.locator("#shadcn-login-form");
  await form.getByRole("button", { name: "LOG IN", exact: true }).click();
  await expect(
    form.getByRole("button", { name: "Please wait…" }),
  ).toBeDisabled();
  await form.evaluate((f) => {
    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => calls).toBe(1);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(26, 26, 26)",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await expect(page.locator('a[href="/#/register"]')).toHaveAttribute(
    "href",
    "/#/register",
  );
  release();
  await expect(page.locator("#catalog")).toBeVisible();
});
