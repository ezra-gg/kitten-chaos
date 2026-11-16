import { Game } from './game/game';
import { Renderer } from './render/canvas';

/**
 * M4 - scoring and loop. Levels load from JSON, chaos is scored into points and
 * 1-3 stars, the result screen shows an incident report, and best results
 * persist in localStorage. Retry / Next move between levels.
 */
function main(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Missing #game canvas');

  const renderer = new Renderer(canvas);
  const game = new Game(renderer);

  (window as unknown as { game: unknown }).game = game;
}

main();
