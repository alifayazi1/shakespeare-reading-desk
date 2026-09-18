import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sectionsFromPlay, scenePath, buildLineIndex } from '../src/lib/reader';
const play = JSON.parse(readFileSync(new URL('../corpus/plays/Err.json', import.meta.url), 'utf8'));

test('actual sample has 11 ordered scenes and preserves all content', () => {
  const sections = sectionsFromPlay(play);
  assert.equal(sections.length, 11);
  assert.equal(sections[0].title, 'ACT 1 · Scene 1');
  assert.equal(sections.at(-1)?.title, 'ACT 5 · Scene 1');
  assert.deepEqual(sections.map(s => s.content), play.acts.flatMap((a: { scenes: { content: unknown }[] }) => a.scenes.map(s => s.content)));
  assert.equal(new Set(sections.map(s => s.slug)).size, 11);
  assert.equal(scenePath(sections[0].slug, 'Err'), '/plays/Err/part-1-section-1/');
});
test('preambles and nonstandard divisions retain order with null IDs', () => {
  const line = { kind: 'line', text: 'A chorus', ftln: null, milestone_id: null, seg_type: 'song' };
  const sections = sectionsFromPlay({ play_id: 'Test', title: 'Test', acts: [{ head: 'Prologue', preamble: [{ kind: 'block', content: [line] }], scenes: [{ head: 'Epilogue', content: [] }] }] });
  assert.deepEqual(sections.map(s => s.slug), ['part-1-preamble', 'part-1-section-1']);
  assert.deepEqual(sections[0].content, [{ kind: 'block', content: [line] }]);
});
test('line index maps every line reference to its built page and anchor', () => {
  const sections = sectionsFromPlay(play);
  const index = buildLineIndex(sections, 'Err');
  // Independent recursive traversal includes lines nested inside speeches/blocks.
  const collectLines = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value.flatMap(collectLines);
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    return item.kind === 'line' ? [item] : Object.values(item).flatMap(collectLines);
  };
  const directLines = collectLines(play);
  assert.equal(index.length, directLines.length, 'index covers every line entry');
  assert.deepEqual(index.filter(l => l.ftln === '1.1.1'), [{ ftln: '1.1.1', anchor: 'ftln-0001', path: '/plays/Err/part-1-section-1/' }]);
  const withFtln = index.every(l => /^\d+\.\d+\.\d+$/.test(l.ftln) && l.anchor && l.path.startsWith('/plays/Err/'));
  assert.ok(withFtln, 'every index entry has a reference, anchor, and path');
  assert.equal(new Set(index.map(l => l.ftln)).size, index.length, 'no duplicate references in the index');
});
test('no-JS line-index page links match the JSON index', () => {
  const html = readFileSync(new URL('../dist/plays/Err/lines/index.html', import.meta.url), 'utf8');
  const index = buildLineIndex(sectionsFromPlay(play), 'Err');
  const hrefs = new Set([...html.matchAll(/href="(\/plays\/Err\/[^"]+#[^"]+)"/g)].map(m => m[1]));
  assert.equal(hrefs.size, index.length);
  for (const { path, anchor } of index) assert.ok(hrefs.has(`${path}#${anchor}`), `${path}#${anchor} missing from built index page`);
});
test('malformed and unknown content fail instead of silently disappearing', () => {
  const input = structuredClone(play);
  input.acts[0].scenes[0].content[0].kind = 'unknown';
  assert.throws(() => sectionsFromPlay(input), /unsupported content kind/);
  assert.throws(() => sectionsFromPlay({}), /missing identity/);
  input.acts[0].scenes[0].content[0] = { kind: 'line', text: 5 };
  assert.throws(() => sectionsFromPlay(input), /missing text/);
});

import { foldText, matchDocuments, parseQuery, highlightSpans, buildSearchIndex } from '../src/lib/search';

test('search folding normalizes case, apostrophes, and diacritics', () => {
  assert.equal(foldText('Rope’s'), foldText("rope's"));
  assert.equal(foldText('Lapland'), 'lapland');
});

test('query parsing keeps words and quoted phrases separate', () => {
  assert.deepEqual(parseQuery('rope’s end'), [
    { phrase: false, tokens: ["rope's"] },
    { phrase: false, tokens: ['end'] },
  ]);
  assert.deepEqual(parseQuery('“healthful welcome”'), [
    { phrase: true, tokens: ['healthful', 'welcome'] },
  ]);
  assert.deepEqual(parseQuery('""   '), []);
});

test('matching supports prefixes, phrases, and apostrophe styles', () => {
  const documents = [
    { text: 'And Lapland sorcerers inhabit here.' },
    { text: 'Thou art, as you are all, a sorceress.' },
    { text: 'And buy a rope’s end. That will I bestow' },
  ];
  assert.deepEqual(matchDocuments(documents, parseQuery('sorcer')), [documents[0], documents[1]]);
  assert.deepEqual(matchDocuments(documents, parseQuery('"sorcer"')), []);
  assert.deepEqual(matchDocuments(documents, parseQuery('"Lapland sorcer"')), []);
  assert.deepEqual(matchDocuments(documents, parseQuery('"rope\'s end"')), [documents[2]]);
  assert.deepEqual(matchDocuments(documents, parseQuery('lapland sorcerers')), [documents[0]]);
  assert.deepEqual(matchDocuments(documents, parseQuery('wander')), []);
});

test('search index covers every line and stage direction with anchors', () => {
  const sections = sectionsFromPlay(play);
  const documents = buildSearchIndex(sections, 'Err');
  const index = buildLineIndex(sections, 'Err');
  const linesInSearch = documents.filter(d => d.kind === 'line');
  assert.equal(linesInSearch.length, index.length, 'one document per line');
  assert.deepEqual(
    linesInSearch.map(d => `${d.path}#${d.anchor}`),
    index.map(l => `${l.path}#${l.anchor}`),
    'line documents link exactly where the line index links',
  );
  assert.ok(documents.some(d => d.kind === 'stage_direction' && d.ref?.startsWith('SD ')), 'stage directions included with SD references');
  const egeon = documents.find(d => d.text.startsWith('Proceed, Solinus'));
  assert.deepEqual(egeon, { kind: 'line', ref: '1.1.1', anchor: 'ftln-0001', path: '/plays/Err/part-1-section-1/', speaker: 'EGEON', text: 'Proceed, Solinus, to procure my fall,' });
});

test('highlight spans mark phrase and prefix matches on original text', () => {
  assert.deepEqual(highlightSpans('And buy a rope’s end. That will I bestow', parseQuery('"rope\'s end"')), [{ start: 10, end: 20 }]);
  const prefix = highlightSpans('Dark-working sorcerers that change the mind,', parseQuery('sorcer'));
  assert.deepEqual(prefix, [{ start: 13, end: 22 }]);
  assert.equal('Dark-working sorcerers that change the mind,'.slice(prefix[0].start, prefix[0].end), 'sorcerers');
  assert.deepEqual(highlightSpans('Lapland sorcerers', parseQuery('"Lapland sorcer"')), []);
  assert.equal(foldText('levièd'), 'levied');
  assert.deepEqual(highlightSpans('levie\u0300d', parseQuery('levied')), [{ start: 0, end: 7 }]);
  assert.deepEqual(highlightSpans('No match here', parseQuery('zebra')), []);
});
