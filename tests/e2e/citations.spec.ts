import { test, expect } from '@playwright/test';
import { discoverPlays } from '../../src/lib/plays';
import { buildQuoteIndex } from '../../src/lib/quotation';

for (const play of discoverPlays()) {
  test(`${play.play_id}: single and range citations, layouts and clipboard`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async (text: string) => { document.documentElement.dataset.clipboardText = text; },
        write: async (items: ClipboardItem[]) => {
          document.documentElement.dataset.clipboardText = await (await items[0].getType('text/plain')).text();
          document.documentElement.dataset.clipboardHtml = await (await items[0].getType('text/html')).text();
        },
      } });
    });
    const index = buildQuoteIndex(play.sections, play.play_id);
    const first = index.find(e => e.ref)!;
    await page.goto(first.path);
    await page.getByText('Quote and cite a line or range', { exact: true }).click();
    const form = page.locator('#citation-form');
    await expect(form).toBeVisible();
    await form.getByLabel('Access date').fill('2026-09-17');
    await form.getByRole('button', { name: 'Preview citation' }).click();
    const plain = form.getByLabel('Plain-text output', { exact: true });
    await expect(plain).toHaveValue(new RegExp(play.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await form.getByRole('button', { name: 'Copy plain text', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-clipboard-text', await plain.inputValue());
    const start = index.findIndex((e, i) => e.form === 'verse' && e.ref && index.slice(i, i + 4).length === 4 && index.slice(i, i + 4).every(next => next.kind === 'line' && next.ref && next.form === 'verse' && next.speech === e.speech));
    expect(start).toBeGreaterThanOrEqual(0);
    await form.getByLabel('Start line', { exact: true }).fill(index[start].ref!);
    await form.getByLabel('End line (optional)').fill(index[start + 3].ref!);
    await expect(form.locator('#citation-output')).toBeHidden();
    await form.getByRole('button', { name: 'Preview citation' }).click();
    await expect(form.locator('#citation-preview blockquote')).toBeVisible();
    await form.getByRole('button', { name: 'Copy formatted', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-clipboard-html', /<blockquote/);
    await form.getByLabel('Quotation layout').selectOption('compact');
    await form.getByRole('button', { name: 'Preview citation' }).click();
    await expect(plain).toHaveValue(/ \/ /);
    await expect(form.locator('#citation-guidance')).toContainText('Compact override');
    await form.getByLabel('Copy contents').selectOption('citation');
    await form.getByLabel('Citation style').selectOption('chicago');
    await form.getByRole('button', { name: 'Preview citation' }).click();
    await expect(plain).toHaveValue(play.play_id === 'TNK' ? /^Shakespeare and Fletcher, / : /^Shakespeare, /);
    expect(await plain.inputValue()).not.toContain(index[start].text);
    await expect(form.getByRole('heading', { name: 'Bibliography entry' })).toBeVisible();
    await form.getByRole('button', { name: 'Copy source entry', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-clipboard-text', /Folger-derived JSON rendition/);
    await form.getByLabel('Start line', { exact: true }).fill('9.9.99999');
    await form.getByRole('button', { name: 'Preview citation' }).click();
    await expect(form.locator('#citation-status')).toContainText('No line');
    await expect(form.locator('#citation-output')).toBeHidden();
  });
}

test('citation index retries and denied clipboard offers selected plain text', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Denied'); } } }));
  await page.route('**/plays/AYL/citation.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/plays/AYL/part-1-section-1/');
  await page.getByText('Quote and cite a line or range', { exact: true }).click();
  const form = page.locator('#citation-form');
  await form.getByRole('button', { name: 'Preview citation' }).click();
  await expect(form.locator('#citation-status')).toContainText('could not be loaded');
  await page.unroute('**/plays/AYL/citation.json');
  await form.getByRole('button', { name: 'Preview citation' }).click();
  await expect(form.locator('#citation-output')).toBeVisible();
  await form.getByRole('button', { name: 'Copy plain text', exact: true }).click();
  await expect(form.locator('#citation-status')).toContainText('Clipboard access is unavailable');
  const field = form.getByLabel('Plain-text output', { exact: true });
  await expect(field).toBeFocused();
  expect(await field.evaluate((el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart)).toBe((await field.inputValue()).length);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('prose layouts, APA, custom formatting and downloadable metadata', async ({ page }) => {
  await page.goto('/plays/AYL/part-1-section-1/');
  await page.locator('#quote-and-cite summary').click();
  await page.getByLabel('End line (optional)').fill('1.1.4');
  const preview = () => page.getByRole('button', { name: 'Preview citation', exact: true }).click();
  await page.getByLabel('Quotation layout').selectOption('lines');
  await preview();
  await expect(page.locator('#citation-preview br')).toHaveCount(3);
  expect(await page.locator('#citation-preview blockquote').evaluate(e => getComputedStyle(e).marginLeft)).toBe('48px');
  await page.getByLabel('Quotation layout').selectOption('slash');
  await preview();
  await expect(page.locator('#citation-plain')).toHaveValue(/ \/ /);
  await page.getByLabel('Citation style', { exact: true }).selectOption('apa');
  await page.getByLabel('Quotation layout').selectOption('auto');
  await preview();
  await expect(page.locator('#citation-source-heading')).toHaveText('Reference entry');
  await expect(page.locator('#citation-layout-status')).toContainText('Compact quotation · prose · 36 words');
  await page.getByLabel('End line (optional)').fill('1.1.5');
  await preview();
  await expect(page.locator('#citation-preview blockquote')).toBeVisible();
  await page.getByLabel('End line (optional)').fill('1.1.4');
  await preview();
  await expect(page.locator('#citation-plain')).toHaveValue(/n\.d\./);
  for (const format of ['RIS', 'BibTeX']) {
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download ${format}` }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(format === 'RIS' ? /\.ris$/ : /\.bib$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString('utf8');
    expect(text).toContain('Shakespeare, William');
    expect(text).toContain('Selected range: 1.1.1–4');
    expect(text).toContain('Folger-derived JSON rendition');
  }
  await page.getByLabel('Citation style', { exact: true }).selectOption('custom');
  await expect(page.locator('#citation-output')).toBeHidden();
  await expect(page.locator('#citation-custom')).toBeVisible();
  await page.getByLabel('Quotation layout').selectOption('compact');
  await page.getByLabel('Line separator', { exact: true }).selectOption('custom');
  await page.getByLabel('Custom separator', { exact: true }).fill(' <join> ');
  await page.getByLabel('Speaker labels').selectOption('no');
  await page.getByLabel('Inline quotation marks').selectOption('no');
  await preview();
  await expect(page.locator('#citation-preview')).toContainText('<join>');
  await expect(page.locator('#citation-preview join')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const reducedMotion of [false, true]) {
  test(`selection shortcut expands lines and respects reduced motion: ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
    await page.goto('/plays/AYL/part-1-section-1/');
    await page.evaluate(() => {
      const native = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (options) {
        if (this.id === 'quote-and-cite') document.documentElement.dataset.scrollBehavior = typeof options === 'object' ? options.behavior : '';
        native.call(this, options);
      };
    });
    const select = () => page.evaluate(() => {
      const lines = document.querySelectorAll('.play-text .line-text');
      // Backward partial selection must still yield document-order whole lines.
      window.getSelection()!.setBaseAndExtent(lines[3].firstChild!, 5, lines[0].firstChild!, 3);
    });
    await select();
    const shortcut = page.getByRole('button', { name: /^Cite this range/ });
    await expect(shortcut).toBeVisible();
    if (reducedMotion) await page.keyboard.press('Alt+Shift+c');
    else await shortcut.click();
    await expect(page.getByLabel('Start line', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Start line', { exact: true })).toHaveValue('1.1.1');
    await expect(page.getByLabel('End line (optional)')).toHaveValue('1.1.4');
    await expect(page.locator('html')).toHaveAttribute('data-scroll-behavior', reducedMotion ? 'instant' : 'smooth');
    await page.getByRole('button', { name: 'Preview citation', exact: true }).click();
    await expect(page.locator('#citation-plain')).toHaveValue(/1\.1\.1–4/);
    await select();
    await expect(shortcut).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(shortcut).toBeHidden();
    await page.evaluate(() => {
      const range = document.createRange(); range.selectNodeContents(document.querySelector('h1')!);
      window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    });
    await expect(shortcut).toBeHidden();
  });
}

