import { KITTENS } from '../config/kittens';
import { KNOCKED_OVER_RETAIN, STAR_THRESHOLDS, UNSPENT_MOVE_BONUS } from '../config/constants';
import { Item } from '../entities/item';

export type IncidentKind = 'broke' | 'knocked';

export interface Incident {
  label: string;
  /** Kitten name, or null if it toppled on its own / via chain with no culprit. */
  culprit: string | null;
  kind: IncidentKind;
}

export interface ScoreResult {
  /** Value of everything still intact (sturdy knocked-over items count partial). */
  survivedValue: number;
  totalValue: number;
  percent: number;
  unspentMoves: number;
  moveBonus: number;
  score: number;
  stars: 0 | 1 | 2 | 3;
  incidents: Incident[];
}

/** Stars from the fraction of total value saved (section 3.3). */
export function computeStars(percent: number): 0 | 1 | 2 | 3 {
  if (percent >= STAR_THRESHOLDS.three) return 3;
  if (percent >= STAR_THRESHOLDS.two) return 2;
  if (percent >= STAR_THRESHOLDS.one) return 1;
  return 0;
}

function culpritName(item: Item): string | null {
  return item.lastCulprit ? KITTENS[item.lastCulprit].name : null;
}

/**
 * Compute the end-of-chaos score, stars and incident report.
 *
 *   survived value = intact items at full value
 *                  + sturdy knocked-over items at a reduced value
 *   score          = survived value + 5 per unspent move
 *   stars          = from survived / total value
 */
export function computeScore(items: readonly Item[], unspentMoves: number): ScoreResult {
  let totalValue = 0;
  let survivedValue = 0;
  const incidents: Incident[] = [];

  for (const item of items) {
    totalValue += item.spec.value;

    if (item.spec.fragile && item.broken) {
      // A broken fragile item may keep a salvage fraction (e.g. a plant's pot
      // shatters but the plant lives).
      survivedValue += item.spec.value * (item.spec.breakRetain ?? 0);
      incidents.push({ label: item.spec.label, culprit: culpritName(item), kind: 'broke' });
    } else if (!item.spec.fragile && item.knockedOver) {
      survivedValue += item.spec.value * KNOCKED_OVER_RETAIN;
      incidents.push({ label: item.spec.label, culprit: culpritName(item), kind: 'knocked' });
    } else {
      survivedValue += item.spec.value;
    }
  }

  const percent = totalValue > 0 ? survivedValue / totalValue : 1;
  const moveBonus = Math.max(0, unspentMoves) * UNSPENT_MOVE_BONUS;

  return {
    survivedValue,
    totalValue,
    percent,
    unspentMoves,
    moveBonus,
    score: Math.round(survivedValue + moveBonus),
    stars: computeStars(percent),
    incidents,
  };
}
