import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverPlays } from '../src/lib/plays';
import { buildLineIndex, isScenePath } from '../src/lib/reader';
import { buildSearchIndex } from '../src/lib/search';
import { sourceFor } from '../src/lib/citations';

const fixture = (id: string, title = 'Title from JSON') => ({ play_id: id, title, acts: [{
  head: 'ACT 1', preamble: [], scenes: [{ head: 'Scene 1', content: [{ kind: 'line', text: 'Test line', ftln: '1.1.1' }] }],
}] });

test('discovery identifies arbitrary filenames by JSON and detects newly added files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reading-desk-'));
  try {
    writeFileSync(join(dir, 'unrelated.JSON'), JSON.stringify(fixture('New')));
    assert.deepEqual(discoverPlays(dir).map(p => [p.play_id, p.title]), [['New', 'Title from JSON']]);
    writeFileSync(join(dir, 'another.json'), JSON.stringify(fixture('AYL', 'As You Like It')));
    assert.deepEqual(discoverPlays(dir).map(p => p.play_id), ['AYL', 'New']);
    writeFileSync(join(dir, 'duplicate.json'), JSON.stringify(fixture('new')));
    assert.throws(() => discoverPlays(dir), /duplicate play_id/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('discovery rejects malformed JSON, unsafe IDs and invalid content with filename context', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reading-desk-'));
  const file = join(dir, 'broken.json');
  try {
    for (const body of ['{', JSON.stringify(fixture('../bad')), JSON.stringify({ play_id: 'Good', title: 'Good', acts: [] })]) {
      writeFileSync(file, body);
      assert.throws(() => discoverPlays(dir), /broken\.json/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('every supplied play has isolated indexes and complete built reader targets', () => {
  const plays = discoverPlays();
  assert.ok(plays.length >= 1, 'at least one play is discovered from corpus/plays');
  const library = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  for (const play of plays) {
    const lines = buildLineIndex(play.sections, play.play_id);
    const search = buildSearchIndex(play.sections, play.play_id);
    assert.ok(library.includes(`id="title-${play.play_id}"`));
    assert.ok(lines.length > 0);
    assert.ok(search.every(entry => isScenePath(entry.path, play.play_id)));
    for (const [name, expected] of [['lines', lines], ['search', search]] as const) {
      const actual = JSON.parse(readFileSync(new URL(`../dist/plays/${play.play_id}/${name}.json`, import.meta.url), 'utf8'));
      assert.deepEqual(actual, expected);
    }
    const indexHtml = readFileSync(new URL(`../dist/plays/${play.play_id}/lines/index.html`, import.meta.url), 'utf8');
    assert.ok(indexHtml.includes(`<title>Line index · ${play.title} — Shakespeare Reading Desk</title>`), 'line-index page title names the play');
    const searchHtml = readFileSync(new URL(`../dist/plays/${play.play_id}/search/index.html`, import.meta.url), 'utf8');
    assert.ok(searchHtml.includes(`<title>Search · ${play.title} — Shakespeare Reading Desk</title>`), 'search page title names the play');
    for (const line of lines) assert.ok(indexHtml.includes(`href="${line.path}#${line.anchor}"`));
    for (const section of play.sections) {
      const html = readFileSync(new URL(`../dist/plays/${play.play_id}/${section.slug}/index.html`, import.meta.url), 'utf8');
      for (const document of search.filter(entry => entry.path === `/plays/${play.play_id}/${section.slug}/`)) {
        assert.ok(html.includes(`id="${document.anchor}"`));
      }
    }
  }
});

test('index paths reject other plays and non-scene destinations', () => {
  assert.ok(isScenePath('/plays/AYL/part-1-preamble/', 'AYL'));
  assert.equal(isScenePath('/plays/Err/part-1-section-1/', 'AYL'), false);
  assert.equal(isScenePath('/plays/AYL/../Err/', 'AYL'), false);
});

test('source records preserve evidence and never fabricate unknown edition details', () => {
  assert.equal(sourceFor('Unknown'), null);
  for (const id of ['AYL', '2H6', 'Err', 'Tmp']) {
    const source = sourceFor(id)!;
    assert.deepEqual(source.editors, ['Barbara Mowat', 'Paul Werstine']);
    assert.equal(source.verified, true);
    assert.ok(source.evidence?.endsWith('/an-introduction-to-this-text/'));
    assert.equal(source.checkedOn, '2026-09-17');
  }
});
