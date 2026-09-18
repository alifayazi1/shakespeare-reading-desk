import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { discoverPlays } from '../src/lib/plays';
import { buildLineIndex } from '../src/lib/reader';
import { buildSearchIndex } from '../src/lib/search';
import { buildQuoteIndex, escapeHtml } from '../src/lib/quotation';

test('source labels survive parsing, both indexes and rendered HTML without line numbers', () => {
  let count = 0;
  for (const play of discoverPlays()) {
    const search = buildSearchIndex(play.sections, play.play_id);
    const quotes = buildQuoteIndex(play.sections, play.play_id);
    const lines = buildLineIndex(play.sections, play.play_id);
    for (const section of play.sections) {
      const labels = section.content.flatMap(e => 'content' in e ? e.content : [e]).filter(e => e.kind === 'label');
      if (!labels.length) continue;
      const html = readFileSync(new URL(`../dist/plays/${play.play_id}/${section.slug}/index.html`, import.meta.url), 'utf8');
      for (const label of labels) {
        for (const index of [search, quotes]) assert.ok(index.some(e => e.kind === 'label' && e.text === label.text && e.anchor === label.label_id && e.ref === null));
        assert.ok(!lines.some(e => e.anchor === label.label_id));
        assert.ok(html.includes(`<p class="text-label" id="${label.label_id}">${escapeHtml(label.text)}</p>`));
        count++;
      }
    }
  }
  assert.ok(count >= 4, 'the four supplied source labels must not disappear');
});
