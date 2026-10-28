import { test, expect } from '@playwright/test';
const lotId = '22222222-2222-4222-8222-222222222222';
const result = {
  lotId, title: 'Settled museum artwork', currency: 'USD', status: 'settled', endTime: '2026-01-01T12:00:00Z', items: [],
  receipt: { id: 'receipt-id', amount: '9007199254740993.01', winnerAlias: 'bidder_private_alias', winningBidId: 'bid-id', endedAt: '2026-01-01T12:00:00Z', settledAt: '2026-01-01T12:00:10Z' },
};
test('shared receipt works logged out and preserves exact amounts on reload', async ({page}) => {
  await page.route('**/api/lots/**', route => {
    expect(route.request().url()).toContain(`/lots/${lotId}/result`);
    expect(route.request().headers().authorization).toBeUndefined();
    return route.fulfill({ json: result });
  });
  await page.goto(`/#/receipt/${lotId}`);
  await expect(page.getByRole('heading', {name: 'SETTLED RECEIPT'})).toBeVisible();
  await expect(page.getByText('$9,007,199,254,740,993.01')).toBeVisible();
  await expect(page.getByText('bidder_private_alias')).toBeVisible();
  const url = await page.getByLabel('SHAREABLE RECEIPT LINK').inputValue();
  expect(url).toContain(`/#/receipt/${lotId}`);
  await page.reload();
  await expect(page.getByRole('heading', {name: 'SETTLED RECEIPT'})).toBeVisible();
});
test('pending settlement refreshes into a receipt without inventing a winner', async ({page}) => {
  let ready = false;
  await page.route('**/api/lots/**', route => route.fulfill({ json: ready ? result : {...result, status: 'pending_settlement', receipt: null} }));
  await page.goto(`/#/receipt/${lotId}`);
  await expect(page.getByText('Settlement is pending.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('SHAREABLE RECEIPT LINK')).toHaveCount(0);
  ready = true;
  await page.getByRole('button', {name: 'REFRESH RESULT'}).click();
  await expect(page.getByRole('heading', {name: 'SETTLED RECEIPT'})).toBeVisible();
});
test('no winner and missing results have explicit states', async ({page}) => {
  let missing = false;
  await page.route('**/api/lots/**', route => route.fulfill(missing ? {status: 404, json: {message: 'Lot not found'}} : {json: {...result, status: 'no_winner', receipt: null}}));
  await page.goto(`/#/receipt/${lotId}`);
  await expect(page.getByText('Closed without a winner.', {exact: false})).toBeVisible();
  await expect(page.getByLabel('SHAREABLE RECEIPT LINK')).toHaveCount(0);
  missing = true;
  await page.getByRole('button', {name: 'REFRESH RESULT'}).click();
  await expect(page.getByRole('alert')).toHaveText('Lot not found');
});

test.beforeEach(async ({page}) => {
  await page.route('**/api/auth/refresh', route => route.fulfill({status:401,json:{message:'Unauthorized'}}));
});
