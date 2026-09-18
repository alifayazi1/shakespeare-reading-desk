import type { APIRoute } from 'astro';
import { playStaticPaths, type AvailablePlay } from '../../../lib/plays';
import { buildLineIndex } from '../../../lib/reader';

export const getStaticPaths = playStaticPaths;
export const GET: APIRoute = ({ props }) => {
  const play = props.play as AvailablePlay;
  return new Response(JSON.stringify(buildLineIndex(play.sections, play.play_id)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};