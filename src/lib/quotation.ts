import { anchorFor, scenePath, type Section, type TextEntry } from './reader';
import { citationStyles, type BuiltinStyle, type CitationStyle, type StyleContext } from './citation-styles';
export type { CitationStyle } from './citation-styles';

export interface QuoteEntry {
  kind: 'line' | 'stage_direction' | 'label';
  text: string;
  ref: string | null;
  anchor: string;
  path: string;
  section: string;
  speech: string;
  speaker: string | null;
  form: 'verse' | 'prose' | 'unknown';
}
export type QuoteLayout = 'auto' | 'block' | 'compact' | 'lines' | 'slash';
export interface CustomQuoteOptions {
  base: BuiltinStyle;
  separator: 'source' | 'slash' | 'space' | 'custom';
  delimiter: string;
  speakers: boolean;
  quotationMarks: boolean;
}
export interface QuoteOptions {
  title: string;
  start: string;
  end?: string;
  style: CitationStyle;
  layout: QuoteLayout;
  includeText: boolean;
  origin: string;
  accessed: string;
  custom?: CustomQuoteOptions;
}

/** Preserve directions, speech boundaries and verse/prose metadata, not just numbered lines. */
export function buildQuoteIndex(sections: Section[], playId: string): QuoteEntry[] {
  return sections.flatMap(section => section.content.flatMap((item, index) => {
    const entry = (child: TextEntry, childIndex: number | null): QuoteEntry => ({
      kind: child.kind, text: child.text, ref: child.kind === 'line' ? child.ftln ?? null : null,
      anchor: anchorFor(child, index, childIndex), path: scenePath(section.slug, playId),
      section: section.title, speech: `${section.slug}:${index}`,
      speaker: 'content' in item && item.kind === 'speech' ? item.speaker_label ?? null : null,
      form: child.type === 'verse' || child.type === 'prose' ? child.type : 'unknown',
    });
    return 'content' in item ? item.content.map(entry) : [entry(item, null)];
  }));
}

export function selectPassage(entries: QuoteEntry[], start: string, end = start): QuoteEntry[] {
  const find = (ref: string) => {
    const matches = entries.flatMap((entry, index) => entry.ref?.toLowerCase() === ref.trim().toLowerCase() ? [index] : []);
    if (matches.length !== 1) throw new Error(matches.length ? `Reference ${ref} is ambiguous in this text.` : `No line ${ref} in this play. Use a reference from the full line index.`);
    return matches[0];
  };
  const first = find(start);
  const last = find(end || start);
  if (last < first) throw new Error('The end line must come after the start line in reading order.');
  return entries.slice(first, last + 1);
}

export function rangeReference(start: string, end: string): string {
  if (start === end) return start;
  const a = start.split('.');
  const b = end.split('.');
  // Full digits avoid ambiguity; never infer missing line numbers.
  return `${start}–${a.slice(0, -1).join('.') === b.slice(0, -1).join('.') ? b.at(-1) : end}`;
}

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function accessDate(value: string, style: CitationStyle): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid access date.');
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Choose a valid access date.');
  const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  return style === 'mla' ? `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`
    : new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}


export function formatQuotation(entries: QuoteEntry[], options: QuoteOptions) {
  const selected = selectPassage(entries, options.start, options.end);
  const first = selected[0];
  const last = selected.at(-1)!;
  const lines = selected.filter(entry => entry.kind === 'line');
  const verse = lines.every(entry => entry.form === 'verse');
  const prose = lines.every(entry => entry.form === 'prose');
  const dialogue = new Set(lines.map(entry => entry.speech)).size > 1;
  const crossSection = first.path !== last.path;
  const words = selected.map(entry => entry.text).join(' ').trim().split(/\s+/).filter(Boolean).length;
  const custom = options.style === 'custom' ? options.custom ?? { base: 'mla', separator: 'source', delimiter: ' | ', speakers: true, quotationMarks: true } : null;
  const styleId: BuiltinStyle = custom?.base ?? (options.style === 'custom' ? 'mla' : options.style);
  const style = citationStyles[styleId];
  const ref = rangeReference(first.ref!, last.ref!);
  const url = new URL(`${first.path}#${encodeURIComponent(first.anchor)}`, options.origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('The source link must use HTTP or HTTPS.');
  const date = accessDate(options.accessed, styleId);
  const context: StyleContext = { playId: first.path.split('/')[2], title: options.title, ref, url: url.href, date, words, verse, prose, lineCount: lines.length };
  const recommendBlock = dialogue || crossSection || !verse && !prose || style.recommendBlock(context);
  const block = options.layout === 'block' || options.layout === 'lines' || options.layout === 'auto' && recommendBlock;
  const warnings: string[] = [];
  warnings.push(style.guidance(context));
  if (prose) warnings.push('This passage is prose. Standard blocks reflow prose; compact uses spaces. Choose source-line or slash override to retain printed boundaries instead.');
  if (custom || options.layout === 'lines' || options.layout === 'slash') warnings.push('Custom layout override: source-line breaks or separators may depart from citation-style conventions, especially for prose.');
  if (dialogue) warnings.push('Multiple speech turns: a dialogue block is recommended; speaker labels and intervening stage directions are retained.');
  if (!verse && !prose) warnings.push('Mixed or unknown verse/prose: check the original layout. The block preserves source line breaks.');
  if (crossSection) warnings.push('The range crosses sections. Bracketed section-change labels are editorial additions by this tool.');
  if (recommendBlock && !block) warnings.push('Compact override: convenient for notes, but not the recommended submission format for this passage.');
  if (first.ref && !/^\d+\.\d+\.\d+$/.test(first.ref)) warnings.push('Named references reproduce this corpus’s notation; explain that notation in your document.');
  const title = options.title;
  const citation = style.citation(context, title);
  const safeContext = { ...context, title: escapeHtml(title), ref: escapeHtml(ref), url: escapeHtml(url.href), date: escapeHtml(date) };
  const citationHtml = style.citation(safeContext, `<i>${escapeHtml(title)}</i>`);
  const source = style.source(context, style.referenceTitle(title), 'Shakespeare Reading Desk');
  const sourceHtml = style.source(safeContext, `<i>${escapeHtml(style.referenceTitle(title))}</i>`, style.italicSite ? '<i>Shakespeare Reading Desk</i>' : 'Shakespeare Reading Desk');
  let body = '';
  let previous: QuoteEntry | undefined;
  let previousSpeech: string | undefined;
  for (const entry of selected) {
    let separator = !previous ? '' : block ? '\n' : ' ';
    if (previous && entry.path !== previous.path) {
      body += `${block ? '\n\n' : ' '}[${entry.section}]${block ? '\n' : ' '}`;
      separator = '';
    } else if (previous && entry.kind === 'line' && previous.kind === 'line' && entry.speech === previous.speech) {
      separator = entry.form === 'prose' && previous.form === 'prose' ? ' ' : block ? '\n' : ' / ';
    }
    if (previous && options.layout === 'slash') separator = ' / ';
    if (previous && options.layout === 'lines') separator = '\n';
    if (previous && custom) separator = custom.separator === 'source' ? '\n' : custom.separator === 'slash' ? ' / ' : custom.separator === 'space' ? ' ' : custom.delimiter;
    const speaker = (custom ? custom.speakers : dialogue) && entry.kind === 'line' && previousSpeech !== entry.speech
      ? `${(entry.speaker ?? 'Unidentified speaker').toUpperCase()}. ` : '';
    const continuation = dialogue && block && !speaker && separator === '\n' ? '    ' : '';
    body += separator + continuation + speaker + (entry.kind === 'stage_direction' ? `[${entry.text}]` : entry.text);
    if (entry.kind === 'line') previousSpeech = entry.speech;
    previous = entry;
  }
  const inlineBody = !style.note ? body.replace(/[.,;:]$/, '') : body;
  const blockBody = styleId === 'apa' && !/[.!?…][”’\]]?$/.test(body) ? `${body}.` : body;
  const quoted = block ? blockBody : custom?.quotationMarks === false ? inlineBody : `“${inlineBody.replace(/[“”]/g, mark => mark === '“' ? '‘' : '’')}”`;
  const suffix = !style.note ? ` ${citation}${block ? '' : '.'}` : `\n\nShortened note: ${citation}`;
  const text = options.includeText ? `${block ? quoted.split('\n').map(line => `    ${line}`).join('\n') : quoted}${suffix}` : citation;
  const quoteHtml = escapeHtml(quoted).replace(/\n/g, '<br>');
  const htmlSuffix = !style.note ? ` ${citationHtml}${block ? '' : '.'}` : `<p>Shortened note: ${citationHtml}</p>`;
  const html = options.includeText ? block
    ? `<blockquote style="margin:0 0 0 0.5in;white-space:pre-wrap;${styleId === 'apa' ? 'line-height:2;' : ''}">${quoteHtml}${htmlSuffix}</blockquote>`
    : `<div>${quoteHtml}${htmlSuffix}</div>` : `<p>${citationHtml}</p>`;
  warnings.push('Source entry cites this downstream rendition, not a verified Folger edition snapshot. No publication date has been inferred. Rich copy retains italics; plain text needs title italics and document-specific spacing after pasting.');
  if (options.origin.includes('localhost') || options.origin.includes('127.0.0.1')) warnings.push('This is a local development URL. Generate the citation on the deployed site before sharing it.');
  if (style.note) warnings.push('Chicago output uses a shortened note: insert it as a footnote/endnote and supply the source entry in your bibliography. It is not author–date style.');
  const layoutLabel = !options.includeText ? 'Citation only · layout does not apply' : `${block ? 'Block quotation' : 'Compact quotation'} · ${verse ? 'verse' : prose ? 'prose' : 'mixed/unknown'} · ${words} words`;
  return { text, html, source, sourceHtml, warnings, block, ref, count: lines.length, layoutLabel, sourceHeading: style.sourceHeading, url: url.href };
}
