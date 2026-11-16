import { Item } from '../entities/item';
import { Surface } from '../entities/surface';

/**
 * Target selection (section 4.2):
 *
 *   attraction = base_appeal
 *              + edge_bonus      (item near the edge of its surface)
 *              + shiny_bonus     (glass, metal)
 *              + dangle_bonus    (cords, plant vines)
 *              - distance_penalty
 *              - puttied_penalty (after a failed bat)
 *
 * These functions are pure so the determinism and scoring tests can exercise
 * them directly.
 */

export interface Point {
  x: number;
  y: number;
}

/** Within this many px of a surface end, an item counts as "near the edge". */
export const EDGE_DISTANCE = 45;

/**
 * How close an item's bottom must be to a surface's top to count as resting on
 * it. Generous enough to tolerate the physics solver letting an item sink a few
 * px into a shelf, but far smaller than the gap between stacked surfaces, so an
 * item on a shelf is never mistaken for being on the floor far below.
 */
export const SURFACE_CONTACT_TOLERANCE = 18;

export interface ScoreWeights {
  edge: number;
  shiny: number;
  dangle: number;
  /** Multiplied by distance in px. */
  distance: number;
  putty: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  edge: 6,
  shiny: 2,
  dangle: 3,
  distance: 0.012,
  putty: 8,
};

/**
 * Find the non-wall surface an item is resting on, if any. Picks the surface
 * whose top is nearest the item's bottom (so a shelf an item sits on always
 * wins over the floor far below it), and returns none if the item isn't in
 * contact with any surface - e.g. while it's mid-fall.
 */
export function findSurfaceUnder(item: Item, surfaces: readonly Surface[]): Surface | undefined {
  const { x, y } = item.body.position;
  const bottom = y + item.spec.h / 2;
  let best: Surface | undefined;
  let bestDist = Infinity;
  for (const s of surfaces) {
    if (s.kind === 'wall') continue;
    const left = s.spec.x;
    const right = s.spec.x + s.spec.w;
    if (x < left || x > right) continue;
    const dist = Math.abs(s.spec.y - bottom);
    if (dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  return bestDist <= SURFACE_CONTACT_TOLERANCE ? best : undefined;
}

/** 0 at the surface center, rising to 1 right at an edge. */
export function edgeProximity(item: Item, surface: Surface): number {
  const x = item.body.position.x;
  const distToEnd = Math.min(x - surface.spec.x, surface.spec.x + surface.spec.w - x);
  if (distToEnd >= EDGE_DISTANCE) return 0;
  return 1 - Math.max(0, distToEnd) / EDGE_DISTANCE;
}

/** Score a single item for a kitten positioned at `from`. */
export function scoreItem(
  from: Point,
  item: Item,
  surfaces: readonly Surface[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number {
  if (item.broken) return -Infinity;

  const surface = findSurfaceUnder(item, surfaces);
  const base = item.spec.baseAppeal;
  const edgeBonus = surface ? edgeProximity(item, surface) * weights.edge : 0;
  const shinyBonus = item.spec.shiny ? weights.shiny : 0;
  const dangleBonus = item.spec.dangle ? weights.dangle : 0;

  const dx = item.body.position.x - from.x;
  const dy = item.body.position.y - from.y;
  const distancePenalty = Math.hypot(dx, dy) * weights.distance;

  const puttyPenalty = item.battedFailures > 0 ? item.battedFailures * weights.putty : 0;

  return base + edgeBonus + shinyBonus + dangleBonus - distancePenalty - puttyPenalty;
}

/**
 * Pick the highest-scoring item, optionally restricted by a reachability
 * filter. Returns null if nothing qualifies. Deterministic: ties resolve to the
 * earlier item in the list.
 */
export function pickTarget(
  from: Point,
  items: readonly Item[],
  surfaces: readonly Surface[],
  filter?: (item: Item) => boolean,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): Item | null {
  let best: Item | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    if (item.broken) continue;
    if (filter && !filter(item)) continue;
    const score = scoreItem(from, item, surfaces, weights);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}
