import { anchorFor, scenePath, type Section, type TextEntry } from './reader';

export interface SearchDocument {
  kind: 'line' | 'stage_direction' | 'label';
  /** act.scene.line for lines, SD act.scene.number for stage directions, or null. */
  ref: string | null;
  anchor: string;
  path: string;
  speaker: string | null;
  text: string;
}

/** Fold case, apostrophes, and diacritics so “Rope’s” and "rope's" match alike. */
export function foldText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u201B\u02BC]/g, "'")
    .toLowerCase();
}

/** Keep original offsets so matching and highlighting use exactly the same words. */
function wordEntries(text: string) {
  return [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['\u2018\u2019\u201B\u02BC][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu)]
    .map(match => ({ value: foldText(match[0]), start: match.index, end: match.index + match[0].length }));
}

export function tokens(text: string): string[] {
  return wordEntries(text).map(word => word.value);
}

export interface SearchTerm {
  phrase: boolean;
  tokens: string[];
}

/** Split a query into word terms and quoted "phrases"; every term must match. */
export function parseQuery(query: string): SearchTerm[] {
  const terms: SearchTerm[] = [];
  for (const [, quoted, plain] of query.replace(/[“”]/g, '"').matchAll(/"([^"]*)"|([^\s"]+)/g)) {
    const piece = quoted ?? plain;
    if (!piece) continue;
    const pieceTokens = tokens(piece);
    if (!pieceTokens.length) continue;
    if (quoted != null) terms.push({ phrase: true, tokens: pieceTokens });
    else terms.push(...pieceTokens.map(token => ({ phrase: false, tokens: [token] })));
  }
  return terms;
}

/** Quoted phrases match complete adjacent words; unquoted terms match prefixes. */
function termMatches(docTokens: string[], term: SearchTerm): boolean {
  return docTokens.some((_, start) =>
    term.tokens.every((token, offset) =>
      term.phrase
        ? docTokens[start + offset] === token
        : docTokens[start + offset]?.startsWith(token) === true,
    ),
  );
}

/** Every document matching all terms, preserving the given (reading) order. */
export function matchDocuments<T extends { text: string }>(documents: T[], terms: SearchTerm[]): T[] {
  if (!terms.length) return [];
  return documents.filter(document => {
    const docTokens = tokens(document.text);
    return terms.every(term => termMatches(docTokens, term));
  });
}

export interface Span {
  start: number;
  end: number;
}

/** Character ranges in the original text to mark for the given terms. */
export function highlightSpans(text: string, terms: SearchTerm[]): Span[] {
  if (!terms.length) return [];
  const words = wordEntries(text);
  const spans: Span[] = [];
  words.forEach((word, position) => {
    for (const term of terms) {
      if (!term.tokens.length) continue;
      const aligned = term.tokens.every((token, offset) => {
        const candidate = words[position + offset]?.value;
        return term.phrase ? candidate === token : candidate?.startsWith(token) === true;
      });
      if (aligned) spans.push({ start: word.start, end: words[position + term.tokens.length - 1].end });
    }
  });
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Span[] = [];
  for (const span of spans) {
    const previous = merged.at(-1);
    if (previous && span.start <= previous.end) previous.end = Math.max(previous.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

function toDocument(entry: TextEntry, anchor: string, speaker: string | null, path: string): SearchDocument {
  return { kind: entry.kind, ref: entry.ftln ?? entry.n ?? null, anchor, path, speaker, text: entry.text };
}

/** Searchable documents for one section, in document order. */
export function searchDocuments(section: Section, playId: string): SearchDocument[] {
  const path = scenePath(section.slug, playId);
  const documents: SearchDocument[] = [];
  section.content.forEach((entry, entryIndex) => {
    if ('content' in entry) {
      const speaker = entry.speaker_label ?? null;
      entry.content.forEach((child, childIndex) =>
        documents.push(toDocument(child, anchorFor(child, entryIndex, childIndex), speaker, path)),
      );
    } else {
      documents.push(toDocument(entry, anchorFor(entry, entryIndex, null), null, path));
    }
  });
  return documents;
}

/** One document per line and stage direction in the play, in reading order. */
export function buildSearchIndex(sections: Section[], playId: string): SearchDocument[] {
  return sections.flatMap(section => searchDocuments(section, playId));
}
