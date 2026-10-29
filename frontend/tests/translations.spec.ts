import { test, expect, type Page } from "@playwright/test";
import { setup, lot } from "./support/api";
import { translate } from "../src/i18n/translate";

async function signIn(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("EMAIL ADDRESS").fill("test@example.com");
  await page.getByLabel("PASSWORD", { exact: true }).fill("test-password-123");
  await page
    .locator("#shadcn-login-form")
    .getByRole("button", { name: "LOG IN", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}

async function portuguese(page: Page) {
  await page.getByRole("button", { name: "PT", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt");
}

test("language persists and guest room tabs, controls and artwork metadata stay consistent", async ({
  page,
}) => {
  await setup(page);
  await page.route(`**/api/lots/${lot.id}/bids?**`, (route) =>
    route.fulfill({
      json: {
        items: [],
        total: 0,
        page: 1,
        status: "open",
        currency: "USD",
        startingBid: "100.00",
        currentBid: null,
        minimumNextBid: "100.00",
        endTime: new Date(Date.now() + 3600000).toISOString(),
        serverTime: new Date().toISOString(),
      },
    }),
  );
  await page.goto("/#/home");
  await portuguese(page);
  await page.goto(`/#/lot/${lot.id}`);
  await expect(
    page.getByRole("tab", { name: "Lance", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Entre para dar um lance", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Atualizar lote", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Histórico", exact: true }).click();
  await expect(page.getByText("Nenhum lance ainda.")).toBeVisible();
  await page
    .getByRole("tab", { name: "Detalhes da obra", exact: true })
    .click();
  await expect(page.getByText("Oil on canvas", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Lance", exact: true }),
  ).toBeVisible();
  await page.goto("/#/home");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.goto(`/#/lot/${lot.id}`);
  await expect(
    page.getByRole("tab", { name: "Bid", exact: true }),
  ).toBeVisible();
});

test("wallet errors switch language and uncertain deposits preserve their original payload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = await setup(page, { failFirst: true });
  await signIn(page);
  await page.goto("/#/wallet");
  await portuguese(page);
  await expect(
    page.getByRole("heading", { name: "Minha carteira", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Simular depósito", exact: true })
    .click();
  await expect(
    page.getByText("Informe um valor maior que US$ 0,00."),
  ).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByText("Enter an amount greater than $0.00."),
  ).toBeVisible();
  await portuguese(page);
  await page
    .getByLabel("Valor do depósito (USD)", { exact: true })
    .fill("50.00");
  await page
    .getByRole("button", { name: "Simular depósito", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reenviar depósito", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText(
      "Não foi possível acessar o servidor. Verifique sua conexão e tente novamente.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reenviar depósito", exact: true })
    .click();
  await expect.poll(() => mock.deposits.length).toBe(2);
  expect(mock.deposits[1]).toEqual(mock.deposits[0]);
  expect(mock.deposits[0].amount).toBe("50.00");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(page.getByLabel("Saldos da carteira")).toContainText("$130.00");
});

test("seller translates category labels and calendar without translating API filters", async ({
  page,
}) => {
  await setup(page, { role: "auctioneer" });
  const requests: string[] = [];
  const artwork = {
    articArtworkId: 141639,
    name: "Museum painting",
    artistDisplay: "Museum artist",
    imageUrl: "https://example.invalid/art.svg",
    isPublicDomain: true,
    artworkType: "Painting",
  };
  await page.route("**/api/lots/mine?**", (r) =>
    r.fulfill({ json: { items: [], total: 0, page: 1 } }),
  );
  await page.route("**/api/catalog/search?**", (r) => {
    requests.push(new URL(r.request().url()).searchParams.get("type") ?? "");
    return r.fulfill({
      json: { items: [artwork], total: 1, page: 1, provider: "cleveland" },
    });
  });
  await page.route("**/api/catalog/artworks/*", (r) =>
    r.fulfill({ json: artwork }),
  );
  await page.route(artwork.imageUrl, (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>',
    }),
  );
  await signIn(page);
  await page.goto("/#/seller");
  await portuguese(page);
  await page.getByRole("button", { name: "Criar lote +", exact: true }).click();
  await expect.poll(() => requests).toContain("Painting");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Desenhos", exact: true }).click();
  await page.getByRole("button", { name: "BUSCAR", exact: true }).click();
  await expect.poll(() => requests.at(-1)).toBe("Drawing");
  await page
    .getByRole("button", { name: "Selecionar Museum painting", exact: true })
    .click();
  await page.getByLabel("Data e hora de término", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Ir para o próximo mês", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "PUBLICAR LOTE", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Museum painting", { exact: true }),
  ).toBeVisible();
});

test("public audit translates verdict and server explanation, then switches back", async ({
  page,
}) => {
  await setup(page);
  await page.route(`**/api/lots/${lot.id}/audit`, (r) =>
    r.fulfill({
      json: {
        lotId: lot.id,
        title: lot.title,
        status: "not_verifiable",
        reason: "No audit checkpoint covers this history.",
        checkedAt: new Date().toISOString(),
        entries: [],
        checkpoint: null,
        history: [],
      },
    }),
  );
  await page.goto(`/#/audit/${lot.id}`);
  await portuguese(page);
  await expect(
    page.getByText("NÃO VERIFICÁVEL", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Nenhum ponto de verificação cobre este histórico."),
  ).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByText("NOT VERIFIABLE", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No audit checkpoint covers this history."),
  ).toBeVisible();
});

test("receipt translates settlement states and private access instructions", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/#/receipt/${lot.id}`);
  await portuguese(page);
  await expect(
    page.getByRole("heading", { name: "Recibo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Entre como vencedor ou proprietário do lote para ver este recibo.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Verificar histórico de lances",
      exact: true,
    }),
  ).toBeVisible();
});

test("interpolation preserves values and unknown server messages remain readable", () => {
  expect(
    translate("PT", "View lot {title}", { title: "<Painting> {label}" }),
  ).toBe("Ver lote <Painting> {label}");
  expect(translate("PT", "Bid must be at least 9007199254740993.01")).toBe(
    "O lance deve ser de pelo menos 9007199254740993.01",
  );
  expect(translate("PT", "toString")).toBe("toString");
  expect(translate("PT", "Unexpected server message")).toBe(
    "Unexpected server message",
  );
  expect(translate("EN", "Informe um valor maior que US$ 0,00.")).toBe(
    "Enter an amount greater than $0.00.",
  );
});
