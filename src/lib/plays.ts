import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import manifest from '../../corpus/corpus_manifest.json' with { type: 'json' };
import { sectionsFromPlay, type Section } from './reader';

export interface AvailablePlay { play_id: string; title: string; sections: Section[] }

/** Build-time only. Run Astro/scripts from the project root.
 * Discover by file, identify by JSON metadata, and fail loudly on invalid inputs.
 * No manifest entry or edition metadata is required to publish a valid play.
 */
export function discoverPlays(directory = resolve('corpus/plays')): AvailablePlay[] {
  const seen = new Set<string>();
  const order = new Map(Object.values(manifest).map((entry, index) => [entry.play_id, index]));
  return readdirSync(directory).filter(file => /\.json$/i.test(file)).map(file => {
    const filename = join(directory, file);
    try {
      const body = JSON.parse(readFileSync(filename, 'utf8'));
      if (!body || typeof body.play_id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(body.play_id) ||
          typeof body.title !== 'string' || !body.title.trim()) {
        throw new Error('expected a safe play_id and a nonempty title');
      }
      if (seen.has(body.play_id.toLowerCase())) throw new Error(`duplicate play_id: ${body.play_id}`);
      seen.add(body.play_id.toLowerCase());
      return { play_id: body.play_id as string, title: body.title as string, sections: sectionsFromPlay(body) };
    } catch (error) {
      throw new Error(`${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }).sort((a, b) => (order.get(a.play_id) ?? Infinity) - (order.get(b.play_id) ?? Infinity) || a.title.localeCompare(b.title));
}

export function playStaticPaths() {
  return discoverPlays().map(play => ({ params: { play: play.play_id }, props: { play } }));
}
