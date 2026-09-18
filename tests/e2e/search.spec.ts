import { test, expect } from '@playwright/test';

test('bookmarked phrase search loads and links to the exact source passage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/plays/Err/search/?q=' + encodeURIComponent('"healthful welcome"'));
  await expect(page.locator('.search-result')).toHaveCount(1);
  await expect(page.locator('.result-text')).toHaveText('Gave healthful welcome to their shipwracked guests,');
  await expect(page.locator('mark')).toHaveText('healthful welcome');
  await page.locator('.result-meta a').click();
  await expect(page.locator(':target .line-text')).toHaveText('Gave healthful welcome to their shipwracked guests,');
  await expect(page.locator(':target')).toBeInViewport();
  expect(errors).toEqual([]);
});

test('search supports prefixes, empty queries, misses, and reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('region', { name: 'The Comedy of Errors', exact: true }).getByRole('link', { name: 'Search', exact: true }).click();
  const input = page.getByLabel('Search the text', { exact: true });
  await input.fill('SORCER');
  await input.press('Enter');
  await expect(page.locator('.search-result')).toHaveCount(3);
  await expect(page.locator('mark')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.search-result')).toHaveCount(3);
  await input.fill('zzzznotaword');
  await input.press('Enter');
  await expect(page.getByRole('status')).toContainText('No passages match');
  await expect(page.locator('.search-result')).toHaveCount(0);
  await input.fill('');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/search\/$/);
});

test('search retries a failed index request', async ({ page }) => {
  await page.route('**/plays/Err/search.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/plays/Err/search/?q=healthful');
  await expect(page.getByRole('status')).toContainText('could not be loaded');
  await page.unroute('**/plays/Err/search.json');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.search-result')).toHaveCount(1);
});

test('search has an honest no-JavaScript fallback', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/plays/Err/search/');
  await expect(page.locator('#search-form')).toBeHidden();
  await expect(page.getByText('Live search needs JavaScript.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Browse the full line index' }).click();
  await expect(page).toHaveURL(/\/lines\/$/);
  await context.close();
});
