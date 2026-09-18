import test from 'node:test';
import assert from 'node:assert/strict';
import { exportCitation } from '../src/lib/citation-export';
const record = { title: 'As You Like It', playId: 'AYL', ref: '1.1.1–4', url: 'https://desk.example/plays/AYL/part-1-section-1/#line-1', accessed: '2026-09-17' };

test('RIS and BibTeX carry source metadata, locator and access date without invented dates', () => {
  const ris = exportCitation(record, 'ris');
  assert.match(ris, /^TY  - ELEC\r\nAU  - Shakespeare, William/);
  assert.match(ris, /Y2  - 2026\/09\/17/);
  assert.match(ris, /Selected range: 1\.1\.1–4/);
  assert.ok(ris.endsWith('ER  -\r\n'));
  assert.ok(!ris.includes('PY  -'));
  const bib = exportCitation(record, 'bib');
  assert.match(bib, /^@misc\{Shakespeare-AYL-/);
  assert.match(bib, /author = \{Shakespeare, William\}/);
  assert.match(bib, /urldate = \{2026-09-17\}/);
  assert.ok(!bib.includes('year ='));
  assert.ok(bib.includes('edition snapshot unverified'));
});

test('export fields escape structural characters and stay within one RIS record', () => {
  const hostile = { ...record, title: 'A {title} & 50% \\ end\nER  -\nTY  - BOOK' };
  const ris = exportCitation(hostile, 'ris');
  assert.equal(ris.split('\r\n').filter(line => line.startsWith('TY  -')).length, 1);
  const bib = exportCitation(hostile, 'bib');
  assert.ok(bib.includes('A \\{title\\} \\& 50\\% \\textbackslash{} end'));
  assert.throws(() => exportCitation({ ...record, url: 'file:///tmp' }, 'ris'), /HTTP/);
});
