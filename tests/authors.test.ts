import test from 'node:test';
import assert from 'node:assert/strict';
import { citationStyles } from '../src/lib/citation-styles';
import { exportCitation } from '../src/lib/citation-export';
import { buildQuoteIndex, formatQuotation } from '../src/lib/quotation';
import { discoverPlays } from '../src/lib/plays';

test('Folger-confirmed Kinsmen coauthor appears in every citation style and export', () => {
  const play = discoverPlays().find(p => p.play_id === 'TNK')!;
  const entries = buildQuoteIndex(play.sections, play.play_id);
  const start = entries.find(e => e.ref)?.ref!;
  for (const style of ['mla', 'chicago', 'apa'] as const) {
    const out = formatQuotation(entries, { title: play.title, start, style, layout: 'auto', includeText: false, origin: 'https://example.org', accessed: '2026-09-17' });
    assert.match(out.text, /Fletcher/);
    assert.match(out.source, /Fletcher/);
    assert.match(out.sourceHtml, /Fletcher/);
  }
  const record = { title: play.title, playId: play.play_id, ref: start, url: 'https://example.org/plays/TNK/', accessed: '2026-09-17' };
  assert.match(exportCitation(record, 'ris'), /AU  - Fletcher, John/);
  assert.match(exportCitation(record, 'bib'), /Shakespeare, William and Fletcher, John/);
  assert.equal(citationStyles.apa.referenceTitle(play.title), 'The two noble kinsmen');
});
