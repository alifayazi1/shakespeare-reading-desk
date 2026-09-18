import { authorCredit } from './authors';
export interface CitationRecord { title: string; playId: string; ref: string; url: string; accessed: string }
const singleLine = (value: string) => value.replace(/[\r\n\u0000-\u001f\u007f]+/g, ' ');
const bibText = (value: string) => singleLine(value).replace(/[\\{}%&#_$^~]/g, char => ({ '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '%': '\\%', '&': '\\&', '#': '\\#', '_': '\\_', '$': '\\$', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}' })[char]!);

/** Style-independent source metadata; deliberately omit unverified publication dates and editors. */
export function exportCitation(record: CitationRecord, format: 'ris' | 'bib'): string {
  const url = new URL(record.url);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('The source link must use HTTP or HTTPS.');
  const note = `Folger-derived JSON rendition. Selected range: ${record.ref}. Publication date and edition snapshot unverified.`;
  if (format === 'ris') return [
    'TY  - ELEC', ...authorCredit(record.playId).names.map(name => `AU  - ${singleLine(name)}`), `TI  - ${singleLine(record.title)}`,
    'T2  - Shakespeare Reading Desk', `UR  - ${singleLine(url.href)}`,
    `Y2  - ${singleLine(record.accessed.replace(/-/g, '/'))}`, `N1  - ${singleLine(note)}`, 'ER  -', '',
  ].join('\r\n');
  const key = `Shakespeare-${record.playId}-${record.ref}`.replace(/[^A-Za-z0-9-]/g, '-');
  return `@misc{${key},\n  author = {${authorCredit(record.playId).names.map(bibText).join(' and ')}},\n  title = {${bibText(record.title)}},\n  howpublished = {Shakespeare Reading Desk},\n  url = {${bibText(url.href)}},\n  urldate = {${bibText(record.accessed)}},\n  note = {${bibText(note)}}\n}\n`;
}
