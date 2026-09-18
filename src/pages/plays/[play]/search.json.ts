import type { APIRoute } from 'astro';
import { playStaticPaths, type AvailablePlay } from '../../../lib/plays';
import { buildSearchIndex } from '../../../lib/search';

export const getStaticPaths = playStaticPaths;
export const GET: APIRoute = ({ props }) => {
  const play = props.play as AvailablePlay;
  return new Response(JSON.stringify(buildSearchIndex(play.sections, play.play_id)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
