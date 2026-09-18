import { test, expect } from '@playwright/test';
import { discoverPlays } from '../../src/lib/plays';
import { buildQuoteIndex } from '../../src/lib/quotation';
import { datasetInfo } from '../../src/lib/dataset';

test('compact library and About work on narrow screens without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.book')).toHaveCount(discoverPlays().length);
  await expect(page.locator('body')).not.toContainText('Development preview');
  await expect(page.locator('.site-header')).not.toContainText('Reader preview');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: 'About', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'About this desk', exact: true })).toBeVisible();
  await expect(page.locator('main time')).toHaveText(datasetInfo.receivedOn);
  await page.screenshot({ path: 'test-results/about-mobile.png' });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/library-mobile.png' });
  await context.close();
});

test('Richard III labels are searchable and its citation index loads', async ({ page }) => {
  await page.goto('/plays/R3/search/?q=oration');
  await expect(page.locator('.search-result')).toHaveCount(2);
  await page.locator('.search-result a').first().click();
  await expect(page.locator('.text-label:target')).toContainText('His oration');
  const entries = buildQuoteIndex(discoverPlays().find(p => p.play_id === 'R3')!.sections, 'R3');
  const label = entries.findIndex(e => e.kind === 'label');
  const first = entries.slice(0, label).findLast(e => e.ref)!;
  const last = entries.slice(label + 1).find(e => e.ref)!;
  await page.goto(first.path);
  await page.locator('.citation-tool summary').click();
  await page.getByLabel('Start line', { exact: true }).fill(first.ref!);
  await page.getByLabel('End line (optional)').fill(last.ref!);
  await page.getByRole('button', { name: 'Preview citation', exact: true }).click();
  await expect(page.locator('#citation-plain')).toHaveValue(/His oration/);
});
