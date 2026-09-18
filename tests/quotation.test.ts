import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuoteIndex, formatQuotation, rangeReference, selectPassage, type QuoteEntry, type QuoteOptions } from '../src/lib/quotation';
import { discoverPlays } from '../src/lib/plays';
import { readFileSync } from 'node:fs';

const entries: QuoteEntry[] = Array.from({ length: 5 }, (_, i) => ({
  kind: 'line', text: `Line ${i + 1}.`, ref: `1.1.${i + 1}`, anchor: `line-${i + 1}`,
  path: '/plays/Test/part-1-section-1/', section: 'Act 1 · Scene 1',
  speech: 'speech-1', speaker: 'FIRST', form: 'verse',
}));
const options: QuoteOptions = {
  title: 'A Test Play', start: '1.1.1', style: 'mla', layout: 'auto', includeText: true,
  origin: 'https://desk.example', accessed: '2026-09-17',
};

test('single lines, inclusive ranges, named references and cross-scene references', () => {
  assert.equal(selectPassage(entries, '1.1.1').length, 1);
  assert.equal(selectPassage(entries, ' 1.1.1 ', '1.1.3').length, 3);
  assert.equal(rangeReference('1.1.1', '1.1.3'), '1.1.1–3');
  assert.equal(rangeReference('1.1.20', '1.2.3'), '1.1.20–1.2.3');
  assert.equal(rangeReference('EPI.1', 'EPI.22'), 'EPI.1–22');
  assert.equal(selectPassage([{ ...entries[0], ref: 'EPI.22' }], 'epi.22')[0].ref, 'EPI.22');
  assert.throws(() => selectPassage(entries, '1.1.3', '1.1.1'), /after the start/);
  assert.throws(() => selectPassage(entries, '9.9.9'), /No line/);
  assert.throws(() => selectPassage([...entries, entries[0]], '1.1.1'), /ambiguous/);
});

test('MLA verse switches at four lines; compact override and citation-only are explicit', () => {
  const single = formatQuotation(entries, options);
  assert.equal(single.text, '“Line 1” (Shakespeare, A Test Play 1.1.1).');
  const short = formatQuotation(entries, { ...options, end: '1.1.3' });
  assert.equal(short.block, false);
  assert.ok(short.text.includes('Line 1. / Line 2. / Line 3'));
  const long = formatQuotation(entries, { ...options, end: '1.1.4' });
  assert.equal(long.block, true);
  assert.ok(long.text.includes('\n    Line 2.'));
  assert.ok(long.html.includes('<blockquote'));
  const compact = formatQuotation(entries, { ...options, end: '1.1.4', layout: 'compact' });
  assert.equal(compact.block, false);
  assert.ok(compact.warnings.some(w => w.includes('Compact override')));
  const only = formatQuotation(entries, { ...options, includeText: false });
  assert.equal(only.text, '(Shakespeare, A Test Play 1.1.1)');
  assert.ok(!only.html.includes('Line 1.'));
});

test('prose rejoins without slashes; Chicago uses a shortened note and word threshold', () => {
  const prose = entries.map(e => ({ ...e, form: 'prose' as const }));
  const short = formatQuotation(prose, { ...options, end: '1.1.4' });
  assert.ok(!short.text.includes(' / '));
  assert.equal(short.block, false);
  assert.ok(short.warnings.some(w => w.includes('four typed lines')));
  const long = formatQuotation(prose.map(e => ({ ...e, text: 'word '.repeat(25).trim() })), { ...options, style: 'chicago', end: '1.1.4' });
  assert.equal(long.block, true);
  assert.ok(long.text.endsWith('Shortened note: Shakespeare, A Test Play, 1.1.1–4.'));
  assert.ok(long.source.includes('Accessed September 17, 2026.'));
});

test('directions and speech changes stay in place; output escapes all source HTML', () => {
  const passage = [entries[0], { ...entries[0], kind: 'stage_direction' as const, ref: null, text: 'Exit <someone>.' }, { ...entries[1], speech: 'speech-2', speaker: 'SECOND' }];
  const out = formatQuotation(passage, { ...options, title: '<script>evil</script>', end: '1.1.2' });
  assert.equal(out.block, true);
  assert.ok(out.text.includes('FIRST. Line 1.\n        [Exit <someone>.]\n    SECOND. Line 2.'));
  assert.ok(out.html.includes('&lt;someone&gt;'));
  assert.ok(!out.html.includes('<script>'));
});

test('cross-section ranges retain all entries and identify editorial section labels', () => {
  const other = { ...entries[1], path: '/plays/Test/part-1-section-2/', ref: '1.2.1', section: 'Act 1 · Scene 2', speech: 'speech-2' };
  const out = formatQuotation([entries[0], other], { ...options, end: '1.2.1' });
  assert.equal(out.ref, '1.1.1–1.2.1');
  assert.equal(out.block, true);
  assert.ok(out.text.includes('[Act 1 · Scene 2]'));
  assert.ok(out.warnings.some(w => w.includes('editorial additions')));
});

test('source entry never invents a publication date or Folger snapshot credit', () => {
  const out = formatQuotation(entries, options);
  assert.ok(out.source.includes('Folger-derived JSON rendition'));
  assert.ok(out.source.includes('Accessed 17 Sept. 2026.'));
  assert.ok(!out.source.includes('Mowat'));
  assert.throws(() => formatQuotation(entries, { ...options, accessed: '2026-02-30' }), /valid access date/);
  assert.throws(() => formatQuotation(entries, { ...options, origin: 'file:///tmp/' }), /HTTP/);
});

test('real corpus index preserves all source items and verse/prose distinctions', () => {
  for (const play of discoverPlays()) {
    const index = buildQuoteIndex(play.sections, play.play_id);
    const source = play.sections.flatMap(s => s.content.flatMap(e => 'content' in e ? e.content : [e]));
    assert.deepEqual(index.map(e => e.text), source.map(e => e.text));
    assert.deepEqual(JSON.parse(readFileSync(new URL(`../dist/plays/${play.play_id}/citation.json`, import.meta.url), 'utf8')), index);
    assert.equal(index.filter(e => e.kind === 'line' && e.form === 'prose').length, source.filter(e => e.kind === 'line' && e.type === 'prose').length);
    assert.ok(index.some(e => e.form === 'verse'));
  }
});

test('explicit prose source lines and slashes differ from standard reflow', () => {
  const prose = entries.map(e => ({ ...e, form: 'prose' as const }));
  const opts = { ...options, end: '1.1.3' };
  assert.ok(!formatQuotation(prose, { ...opts, layout: 'block' }).text.includes('\n'));
  const preserved = formatQuotation(prose, { ...opts, layout: 'lines' });
  assert.ok(preserved.text.includes('\n    Line 2.'));
  assert.ok(preserved.html.includes('<br>'));
  assert.match(preserved.layoutLabel, /Block quotation · prose/);
  const slash = formatQuotation(prose, { ...opts, layout: 'slash' });
  assert.match(slash.text, /Line 1\. \/ Line 2\./);
  assert.ok(!slash.text.includes('\n'));
});

test('APA 7 switches at 40 words and positions block punctuation before citation', () => {
  const passage = (words: number) => [{ ...entries[0], form: 'prose' as const, text: `${'word '.repeat(words - 1)}end.` }];
  const opts = { ...options, style: 'apa' as const, title: 'As You Like It' };
  const short = formatQuotation(passage(39), opts);
  assert.equal(short.block, false);
  assert.match(short.text, /end” \(Shakespeare, n\.d\., act.scene.line 1\.1\.1\)\.$/);
  const long = formatQuotation(passage(40), opts);
  assert.equal(long.block, true);
  assert.match(long.text, /end\. \(Shakespeare, n\.d\., act.scene.line 1\.1\.1\)$/);
  assert.match(long.html, /line-height:2/);
  assert.match(long.source, /Shakespeare, W\. \(n\.d\.\)\. As you like it/);
  assert.ok(!long.source.includes('Accessed'));
  assert.equal(long.sourceHeading, 'Reference entry');
});

test('custom separator, speakers, marks and base citation are independently configurable', () => {
  const custom = { base: 'apa' as const, separator: 'custom' as const, delimiter: ' <join> ', speakers: false, quotationMarks: false };
  const out = formatQuotation(entries, { ...options, style: 'custom', layout: 'compact', end: '1.1.2', custom });
  assert.match(out.text, /Line 1\. <join> Line 2 \(Shakespeare, n\.d\./);
  assert.ok(!out.text.includes('FIRST.'));
  assert.ok(!out.text.includes('“'));
  assert.ok(out.html.includes('&lt;join&gt;'));
  assert.ok(!out.html.includes('<join>'));
  assert.equal(out.sourceHeading, 'Reference entry');
  for (const separator of ['source', 'slash', 'space'] as const) {
    const result = formatQuotation(entries, { ...options, style: 'custom', layout: 'compact', end: '1.1.2', custom: { ...custom, separator, speakers: true, quotationMarks: true } });
    assert.match(result.text, /“FIRST\./);
    assert.ok(result.text.includes(separator === 'source' ? '\n' : separator === 'slash' ? ' / ' : 'Line 1. Line 2'));
  }
});

