import { readFileSync, existsSync } from 'node:fs';
import manifest from '../corpus/corpus_manifest.json';
import characters from '../corpus/characters.json';
import play from '../corpus/plays/Err.json';
import { sectionsFromPlay, buildLineIndex } from '../src/lib/reader';
import { buildSearchIndex } from '../src/lib/search';
import { discoverPlays } from '../src/lib/plays';

const failures: string[] = [];
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

// Corpus manifest coverage
const plays = Object.values(manifest as Record<string, { play_id: string; is_dramatic: boolean }>);
check('manifest lists 38 dramatic plays', plays.length === 38, `found ${plays.length}`);
check('manifest play_ids are unique', new Set(plays.map(p => p.play_id)).size === plays.length);
check('manifest has no non-dramatic entries', plays.every(p => p.is_dramatic === true));

// Characters lookup shape
const entries = Object.entries(characters as Record<string, { kind?: string; name?: string; appearances?: unknown[] }>);
check('characters.json has entries with name, kind, and appearances', entries.every(([, c]) => typeof c.kind === 'string' && typeof c.name === 'string' && Array.isArray(c.appearances) && c.appearances.length > 0));
const recurring = entries.filter(([, c]) => Array.isArray(c.appearances) && c.appearances.length > 1).length;
check('cross-play character recurrence preserved (IDs are not play-scoped)', recurring > 0, `${recurring} character IDs appear in more than one play`);

// Supplied play body
const sections = sectionsFromPlay(play);
const lines = sections.flatMap(s => s.content).flatMap(c => ('content' in c ? c.content : [c])).filter(c => c.kind === 'line');
check('supplied play yields 11 readable sections', sections.length === 11, `found ${sections.length}`);
check('line references are act.scene.line strings', lines.every(l => /^\d+\.\d+\.\d+$/.test(String(l.ftln))));
const lineRefs = new Set(lines.map(l => l.ftln));
check('line references are unique within the play', lineRefs.size === lines.length, `${lines.length} lines, ${lineRefs.size} unique references`);

// Built line index and no-JS line-index page
const index = buildLineIndex(sections, 'Err');
check('line index covers every line', index.length === lines.length, `${index.length} indexed of ${lines.length} lines`);
check('line index paths and anchors are well-formed', index.every(l => /^\/plays\/Err\/part-\d+-section-\d+\/$/.test(l.path) && typeof l.anchor === 'string' && l.anchor.length > 0));
const indexEndpoint = new URL('../dist/plays/Err/lines.json', import.meta.url);
if (existsSync(indexEndpoint)) {
  const served = JSON.parse(readFileSync(indexEndpoint, 'utf8'));
  check('built lines.json matches the source index', JSON.stringify(served) === JSON.stringify(index));
} else {
  failures.push('built lines.json endpoint not found');
  console.log('FAIL  built lines.json is missing — run `npm run build` before validating');
}

const searchIndex = buildSearchIndex(sections, 'Err');
const sourceEntries = sections.flatMap(section => section.content.flatMap(entry => 'content' in entry ? entry.content : [entry]));
check('search covers every source line and direction in order',
  JSON.stringify(searchIndex.map(entry => entry.text)) === JSON.stringify(sourceEntries.map(entry => entry.text)));
const searchEndpoint = new URL('../dist/plays/Err/search.json', import.meta.url);
check('built search index matches source documents', existsSync(searchEndpoint) &&
  JSON.stringify(JSON.parse(readFileSync(searchEndpoint, 'utf8'))) === JSON.stringify(searchIndex));
const sceneAnchors = new Map(sections.map(section => {
  const file = new URL(`../dist/plays/Err/${section.slug}/index.html`, import.meta.url);
  const html = existsSync(file) ? readFileSync(file, 'utf8') : '';
  return [`/plays/Err/${section.slug}/`, new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]))];
}));
check('every search result targets an existing built anchor', searchIndex.every(entry => sceneAnchors.get(entry.path)?.has(entry.anchor)));

// Built output matches source text (requires a fresh `npm run build`)
const decode = (html: string) => html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
let builtScenes = 0;
for (const section of sections) {
  const path = new URL(`../dist/plays/Err/${section.slug}/index.html`, import.meta.url);
  if (!existsSync(path)) continue;
  const html = decode(readFileSync(path, 'utf8'));
  const texts = section.content.flatMap(c => ('content' in c ? c.content : [c])).map(c => String(c.text));
  if (!texts.length || !texts.every(text => html.includes(text))) {
    failures.push(`built page for ${section.slug} does not match source text`);
    console.log(`FAIL  built page ${section.slug} matches source`);
  } else {
    builtScenes += 1;
    console.log(`PASS  built page ${section.slug} matches source`);
  }
}
check('all 11 built scene pages were checked', builtScenes === 11, `checked ${builtScenes}`);

// Check every discovered play, including future additions, not just the Err regression fixture.
for (const available of discoverPlays()) {
  const id = available.play_id;
  const docs = buildSearchIndex(available.sections, id);
  const lineIndex = buildLineIndex(available.sections, id);
  for (const [name, expected] of [['lines', lineIndex], ['search', docs]] as const) {
    const file = new URL(`../dist/plays/${id}/${name}.json`, import.meta.url);
    check(`${id}: built ${name} index matches source`, existsSync(file) &&
      JSON.stringify(JSON.parse(readFileSync(file, 'utf8'))) === JSON.stringify(expected));
  }
  const allLines = available.sections.flatMap(s => s.content.flatMap(e => 'content' in e ? e.content : [e])).filter(e => e.kind === 'line');
  check(`${id}: numbered lines are indexed`, lineIndex.length === allLines.filter(e => e.ftln).length);
  for (const section of available.sections) {
    const file = new URL(`../dist/plays/${id}/${section.slug}/index.html`, import.meta.url);
    const html = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const texts = section.content.flatMap(e => 'content' in e ? e.content : [e]).map(e => e.text);
    const sectionDocs = docs.filter(d => d.path === `/plays/${id}/${section.slug}/`);
    check(`${id}: ${section.slug} text and anchors`, html.length > 0 &&
      texts.every(text => decode(html).includes(text)) && sectionDocs.every(d => html.includes(`id="${d.anchor}"`)));
  }
}

if (failures.length) {
  console.error(`\n${failures.length} validation failure(s)`);
  process.exit(1);
}
console.log('\nValidation complete: no failures.');
