import { authorCredit } from './authors';
export interface StyleContext {
  playId?: string;
  title: string;
  ref: string;
  url: string;
  date: string;
  words: number;
  verse: boolean;
  prose: boolean;
  lineCount: number;
}
export interface CitationStyleDefinition {
  label: string;
  sourceHeading: string;
  note: boolean;
  recommendBlock: (context: StyleContext) => boolean;
  citation: (context: StyleContext, title: string) => string;
  source: (context: StyleContext, title: string, site: string) => string;
  referenceTitle: (title: string) => string;
  italicSite: boolean;
  guidance: (context: StyleContext) => string;
}
const unchanged = (title: string) => title;
// Sentence case, retaining the proper name and Roman numeral in the supplied corpus.
const apaTitle = (title: string) => ({
  'As You Like It': 'As you like it', 'Henry VI, Part 2': 'Henry VI, part 2',
  'The Comedy of Errors': 'The comedy of errors', 'The Tempest': 'The tempest',
  'Henry IV, Part I': 'Henry IV, part I', 'Henry IV, Part 2': 'Henry IV, part 2',
  'Henry VI, Part 1': 'Henry VI, part 1', 'Henry VI, Part 3': 'Henry VI, part 3',
  'King John': 'King John', 'King Lear': 'King Lear',
  'Love’s Labor’s Lost': 'Love’s labor’s lost', 'Measure for Measure': 'Measure for measure',
  'A Midsummer Night’s Dream': 'A midsummer night’s dream',
  'The Merchant of Venice': 'The merchant of Venice',
  'Pericles, Prince of Tyre': 'Pericles, prince of Tyre',
  'The Taming of the Shrew': 'The taming of the shrew',
  'The Two Gentlemen of Verona': 'The two gentlemen of Verona',
  'Twelfth Night': 'Twelfth night', 'The Two Noble Kinsmen': 'The two noble kinsmen',
  'The Merry Wives of Windsor': 'The merry wives of Windsor', 'The Winter’s Tale': 'The winter’s tale',
  'All’s Well That Ends Well': 'All’s well that ends well', 'Much Ado About Nothing': 'Much ado about nothing',
})[title] ?? title;

/** Style policy is separate from quotation assembly and browser controls. No HTML in definitions. */
export const citationStyles = {
  mla: {
    label: 'MLA · parenthetical', sourceHeading: 'Works Cited entry', note: false,
    recommendBlock: c => c.verse && c.lineCount >= 4,
    citation: (c, title) => `(${authorCredit(c.playId).short}, ${title} ${c.ref})`,
    source: (c, title, site) => `${authorCredit(c.playId).full}. ${title}. ${site}, Folger-derived JSON rendition, ${c.url}. Accessed ${c.date}.`,
    referenceTitle: unchanged, italicSite: true,
    guidance: c => c.prose
      ? 'MLA prose: use a block if the quotation exceeds four typed lines in your document. Source line numbers cannot measure that; choose Block when needed.'
      : 'MLA: up to three verse lines may run in with spaced slashes; four or more use a block.',
  },
  chicago: {
    label: 'Chicago · shortened note', sourceHeading: 'Bibliography entry', note: true,
    recommendBlock: c => c.verse && c.lineCount > 3 || c.prose && c.words >= 100,
    citation: (c, title) => `${authorCredit(c.playId).short}, ${title}, ${c.ref}.`,
    source: (c, title, site) => `${authorCredit(c.playId).full}. ${title}. ${site}. Folger-derived JSON rendition. Accessed ${c.date}. ${c.url}.`,
    referenceTitle: unchanged, italicSite: true,
    guidance: c => c.prose
      ? 'Chicago: about 100 words or more generally warrants a prose block. Adjust to your assignment and document layout.'
      : 'Chicago permits short verse run-ins with slashes. This tool conservatively recommends a block above three lines; that cutoff is a tool default, not a universal Chicago rule.',
  },
  apa: {
    label: 'APA 7 · author–date', sourceHeading: 'Reference entry', note: false,
    recommendBlock: c => c.words >= 40,
    citation: c => `(${authorCredit(c.playId).apaShort}, n.d., ${/^\d+\.\d+\.\d+/.test(c.ref) ? 'act.scene.line' : 'reference'} ${c.ref})`,
    source: (c, title, site) => `${authorCredit(c.playId).apaFull} (n.d.). ${title} [Folger-derived JSON rendition]. ${site}. ${c.url}`,
    referenceTitle: apaTitle, italicSite: false,
    guidance: () => 'APA 7: 40 words or more use an indented, double-spaced block without quotation marks, with the citation after closing punctuation. n.d. means no verified date; act.scene.line is a locator, not a page number. No original-publication year is inferred. Reference titles use sentence case; check proper nouns when adding plays. A retrieval date is not required merely because a source is undated.',
  },
} satisfies Record<string, CitationStyleDefinition>;
export type BuiltinStyle = keyof typeof citationStyles;
export type CitationStyle = BuiltinStyle | 'custom';
export const styleChoices = [...Object.entries(citationStyles).map(([value, style]) => ({ value, label: style.label })), { value: 'custom', label: 'Custom · your own formatting' }];
