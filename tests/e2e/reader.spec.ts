import { test, expect } from '@playwright/test';
import { discoverPlays } from '../../src/lib/plays';
import { buildLineIndex } from '../../src/lib/reader';

test('reader shows source text and scene selector navigates', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('region', { name: 'The Comedy of Errors', exact: true }).getByRole('link', { name: 'Start reading' }).click();
  await expect(page.locator('.line-text').first()).toHaveText('Proceed, Solinus, to procure my fall,');
  await expect(page.getByRole('navigation', { name: 'Play sections' }).getByRole('link')).toHaveCount(11);
  await page.getByLabel('Choose a scene').selectOption('/plays/Err/part-1-section-2/');
  await expect(page).toHaveURL(/part-1-section-2\/$/);
  await expect(page.getByRole('heading', { name: 'ACT 1 · Scene 2', exact: true })).toBeVisible();
  await page.locator('.line-number').first().click();
  await expect(page).toHaveURL(/#ftln-/);
  expect(errors).toEqual([]);
});

test('go-to-line form jumps across scenes and reports misses', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/plays/Err/part-1-section-1/');
  await page.getByLabel('Go to a line (act.scene.line)').fill('5.1.400');
  await page.getByRole('button', { name: 'Go' }).click();
  await expect(page).toHaveURL(/part-5-section-1\/#ftln-1857$/);
  await expect(page.locator('.verse-line:target .line-number')).toHaveText('5.1.400');
  await expect(page.locator('.verse-line:target')).toBeInViewport();
  await page.getByLabel('Go to a line (act.scene.line)').fill('5.1.1');
  await page.getByLabel('Go to a line (act.scene.line)').press('Enter');
  await expect(page.locator('.verse-line:target .line-number')).toHaveText('5.1.1');
  await page.goto('/plays/Err/part-1-section-1/');
  await page.getByLabel('Go to a line (act.scene.line)').fill('2.9.999');
  await page.getByRole('button', { name: 'Go' }).click();
  await expect(page.locator('#ftln-error')).toContainText('No line 2.9.999');
  await page.getByLabel('Go to a line (act.scene.line)').fill('hello');
  await page.getByRole('button', { name: 'Go' }).click();
  await expect(page.locator('#ftln-error')).toContainText('three numbers with dots');
  expect(errors).toEqual([]);
});

test('line index endpoint serves complete JSON', async ({ request }) => {
  const response = await request.get('/plays/Err/lines.json');
  expect(response.ok()).toBe(true);
  const index = await response.json();
  const play = discoverPlays().find(play => play.play_id === 'Err')!;
  expect(index).toEqual(buildLineIndex(play.sections, play.play_id));
  expect(index[0]).toEqual({ ftln: '1.1.1', anchor: 'ftln-0001', path: '/plays/Err/part-1-section-1/' });
});

test('mobile layout fits and plain links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/plays/Err/part-1-section-1/');
  await expect(page.locator('.line-text').first()).toBeVisible();
  await page.getByRole('navigation', { name: 'Play sections' }).getByRole('link', { name: 'ACT 5 · Scene 1', exact: true }).click();
  await expect(page).toHaveURL(/part-5-section-1\/$/);
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
  await expect(page.locator('#go-to-line')).toBeHidden();
  await page.getByRole('link', { name: 'Browse the full line index' }).click();
  await page.getByRole('link', { name: '1.1.1', exact: true }).click();
  await expect(page).toHaveURL(/part-1-section-1\/#ftln-0001$/);
  await expect(page.locator('.verse-line:target')).toBeInViewport();
  await page.screenshot({ path: 'test-results/reader-mobile.png', fullPage: false });
  await context.close();
});

test('line index fetch failure is recoverable', async ({ page }) => {
  await page.route('**/plays/Err/lines.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/plays/Err/part-1-section-1/');
  const input = page.getByLabel('Go to a line (act.scene.line)');
  await input.fill('1.1.2');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText('could not be loaded');
  await expect(input).toBeFocused();
  await page.unroute('**/plays/Err/lines.json');
  await input.press('Enter');
  await expect(page.locator('.verse-line:target .line-number')).toHaveText('1.1.2');
});

