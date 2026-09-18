import { test, expect } from '@playwright/test';
import { discoverPlays } from '../../src/lib/plays';
import { buildLineIndex } from '../../src/lib/reader';
import { buildSearchIndex } from '../../src/lib/search';

for (const play of discoverPlays()) {
  test(`${play.play_id}: library, navigation, line jump and search stay in this play`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const book = page.getByRole('region', { name: play.title, exact: true });
    await expect(book).toBeVisible();
    await book.getByRole('link', { name: 'Start reading' }).click();
    await expect(page).toHaveURL(`/plays/${play.play_id}/${play.sections[0].slug}/`);
    await expect(page.getByRole('heading', { name: play.title, exact: true })).toBeVisible();
    const lines = buildLineIndex(play.sections, play.play_id);
    const last = lines.at(-1)!;
    await page.getByLabel('Go to a line (act.scene.line)').fill(last.ftln);
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page).toHaveURL(`${last.path}#${last.anchor}`);
    await page.getByLabel('Choose a scene').selectOption(`/plays/${play.play_id}/${play.sections[0].slug}/`);
    await expect(page).toHaveURL(`/plays/${play.play_id}/${play.sections[0].slug}/`);
    const passage = buildSearchIndex(play.sections, play.play_id).find(d => d.kind === 'line' && d.text.length > 20)!;
    await page.goto(`/plays/${play.play_id}/search/?q=${encodeURIComponent('"' + passage.text + '"')}`);
    const link = page.locator('.search-result a').filter({ hasText: passage.ref! }).first();
    await expect(link).toHaveAttribute('href', `${passage.path}#${passage.anchor}`);
    await link.click();
    await expect(page).toHaveURL(`${passage.path}#${passage.anchor}`);
    expect(errors).toEqual([]);
  });
}

test('sources page exposes evidence and clearly limits citation claims', async ({ page }) => {
  await page.goto('/sources/');
  await expect(page.getByRole('heading', { name: 'Sources and citation guidance', exact: true })).toBeVisible();
  await expect(page.locator('#AYL')).toContainText('Barbara Mowat, Paul Werstine');
  await expect(page.locator('[id="2H6"] a').first()).toHaveAttribute('href', /henry-vi-part-2\/read\/$/);
  await expect(page.getByRole('heading', { name: 'MLA, Chicago, APA 7 and custom quotations' })).toBeVisible();
});
