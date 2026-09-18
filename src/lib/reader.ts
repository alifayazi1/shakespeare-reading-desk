export interface TextEntry {
  kind: 'line' | 'stage_direction' | 'label';
  label_id?: string | null;
  text: string;
  type?: string | null;
  ftln?: string | null;
  milestone_id?: string | null;
  stage_id?: string | null;
  n?: string | null;
}
export interface Container {
  kind: 'speech' | 'block';
  speaker_label?: string | null;
  content: TextEntry[];
}
export type Content = TextEntry | Container;
export interface Section {
  slug: string;
  title: string;
  content: Content[];
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path}: expected an object`);
  }
  return value as Record<string, unknown>;
}
function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path}: expected an array`);
  return value;
}
function label(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim() : fallback;
}
function content(value: unknown, path: string, nested = false): Content[] {
  return array(value, path).map((item, index) => {
    const location = `${path}[${index}]`;
    const entry = record(item, location);
    if (entry.kind === 'line' || entry.kind === 'stage_direction' || entry.kind === 'label') {
      if (typeof entry.text !== 'string') throw new Error(`${location}: missing text`);
      for (const key of ['ftln', 'milestone_id', 'stage_id', 'label_id', 'n']) {
        if (entry[key] != null && typeof entry[key] !== 'string') {
          throw new Error(`${location}.${key}: expected text or null`);
        }
      }
      return entry as unknown as TextEntry;
    }
    if (!nested && (entry.kind === 'speech' || entry.kind === 'block')) {
      if (entry.speaker_label != null && typeof entry.speaker_label !== 'string') {
        throw new Error(`${location}: invalid speaker label`);
      }
      return { ...entry, content: content(entry.content, `${location}.content`, true) } as Container;
    }
    throw new Error(`${location}: unsupported content kind ${String(entry.kind)}`);
  });
}

/** Validate the reader's input contract, preserving source order and fields.
 * This is not a full corpus schema validator or an XML fidelity check.
 */
export function sectionsFromPlay(value: unknown): Section[] {
  const play = record(value, 'play');
  if (typeof play.play_id !== 'string' || typeof play.title !== 'string') {
    throw new Error('play: missing identity or title');
  }
  const sections: Section[] = [];
  array(play.acts, 'play.acts').forEach((value, actIndex) => {
    const act = record(value, `acts[${actIndex}]`);
    const actTitle = label(act.head, label(act.act_type, 'Section'));
    const preamble = content(act.preamble, `acts[${actIndex}].preamble`);
    // Structural positions are stable within this corpus snapshot; null IDs are valid.
    if (preamble.length) sections.push({ slug: `part-${actIndex + 1}-preamble`, title: actTitle, content: preamble });
    array(act.scenes, `acts[${actIndex}].scenes`).forEach((value, sceneIndex) => {
      const scene = record(value, `acts[${actIndex}].scenes[${sceneIndex}]`);
      sections.push({
        slug: `part-${actIndex + 1}-section-${sceneIndex + 1}`,
        title: `${actTitle} · ${label(scene.head, label(scene.scene_type, 'Section'))}`,
        content: content(scene.content, `acts[${actIndex}].scenes[${sceneIndex}].content`),
      });
    });
  });
  if (!sections.length) throw new Error('play: no readable sections');
  return sections;
}

export const scenePath = (slug: string, playId: string) => `/plays/${playId}/${slug}/`;

/** Index links must stay inside the current play and target a generated section. */
export function isScenePath(path: string, playId: string): boolean {
  const prefix = `/plays/${playId}/`;
  return path.startsWith(prefix) && /^part-\d+-(?:section-\d+|preamble)\/$/.test(path.slice(prefix.length));
}

export function anchorFor(entry: TextEntry, entryIndex: number, childIndex: number | null): string {
  return entry.milestone_id ?? entry.stage_id ?? entry.label_id ?? (childIndex === null ? `entry-${entryIndex}` : `entry-${entryIndex}-${childIndex}`);
}

export interface LineRef { ftln: string; anchor: string }

/** Line references in this section, in reading order, with the anchor used in the built page. */
export function lineEntries(section: Section): LineRef[] {
  const out: LineRef[] = [];
  section.content.forEach((entry, entryIndex) => {
    if ('content' in entry) {
      entry.content.forEach((child, childIndex) => {
        if (child.kind === 'line' && child.ftln) out.push({ ftln: child.ftln, anchor: anchorFor(child, entryIndex, childIndex) });
      });
    } else if (entry.kind === 'line' && entry.ftln) {
      out.push({ ftln: entry.ftln, anchor: anchorFor(entry, entryIndex, null) });
    }
  });
  return out;
}

export interface IndexedLine extends LineRef { path: string }

/** One entry per line in the play, mapping its act.scene.line reference to the built page and anchor. */
export function buildLineIndex(sections: Section[], playId: string): IndexedLine[] {
  return sections.flatMap(section =>
    lineEntries(section).map(({ ftln, anchor }) => ({ ftln, anchor, path: scenePath(section.slug, playId) })),
  );
}
