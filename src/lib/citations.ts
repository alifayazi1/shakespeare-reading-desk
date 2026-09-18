import editions from '../../metadata/editions.json';

interface Edition {
  slug: string;
  editors: string[] | null;
  verified: boolean;
  evidence?: string;
  checkedOn?: string;
}

/** Unknown plays remain readable without inventing a Folger URL or editor credit. */
export function sourceFor(playId: string) {
  const edition = (editions.plays as Record<string, Edition>)[playId];
  if (!edition) return null;
  return { ...edition, url: `https://www.folger.edu/explore/shakespeares-works/${edition.slug}/read/` };
}
