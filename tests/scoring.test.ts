import { describe, expect, it } from 'vitest';
import { Item, ItemType } from '../src/entities/item';
import { computeScore, computeStars } from '../src/game/scoring';

function makeItem(type: ItemType): Item {
  return new Item(type, 100, 100);
}

describe('computeStars', () => {
  it('maps value-saved fraction to stars (section 3.3)', () => {
    expect(computeStars(1.0)).toBe(3);
    expect(computeStars(0.9)).toBe(2);
    expect(computeStars(0.75)).toBe(2);
    expect(computeStars(0.6)).toBe(1);
    expect(computeStars(0.5)).toBe(1);
    expect(computeStars(0.49)).toBe(0);
    expect(computeStars(0)).toBe(0);
  });
});

describe('computeScore', () => {
  it('scores all-intact items at full value plus move bonus', () => {
    const items = [makeItem('mug'), makeItem('vase')]; // 10 + 30
    const r = computeScore(items, 2);
    expect(r.survivedValue).toBe(40);
    expect(r.totalValue).toBe(40);
    expect(r.moveBonus).toBe(10); // 2 * 5
    expect(r.score).toBe(50);
    expect(r.stars).toBe(3);
    expect(r.incidents).toHaveLength(0);
  });

  it('a broken fragile item contributes nothing and is reported', () => {
    const mug = makeItem('mug');
    const vase = makeItem('vase');
    vase.broken = true;
    vase.lastCulprit = 'A'; // Bargie
    const r = computeScore([mug, vase], 0);
    expect(r.survivedValue).toBe(10); // only the mug
    expect(r.totalValue).toBe(40);
    expect(r.incidents).toEqual([{ label: 'Vase', culprit: 'Bargie', kind: 'broke' }]);
  });

  it('a broken plant keeps its salvage fraction', () => {
    const plant = makeItem('plant'); // value 8, breakRetain 0.5
    plant.broken = true;
    const r = computeScore([plant], 0);
    expect(r.survivedValue).toBe(4);
    expect(r.incidents[0]).toMatchObject({ label: 'Plant', kind: 'broke', culprit: null });
  });

  it('a knocked-over sturdy item keeps half value', () => {
    const book = makeItem('book'); // value 5, sturdy
    book.body.angle = 1.2; // past KNOCKED_OVER_ANGLE
    book.lastCulprit = 'B'; // Beano
    const r = computeScore([book], 0);
    expect(r.survivedValue).toBeCloseTo(2.5);
    expect(r.incidents).toEqual([{ label: 'Book', culprit: 'Beano', kind: 'knocked' }]);
  });

  it('computes percent and stars from survived/total', () => {
    const lamp = makeItem('lamp'); // 80
    const mug = makeItem('mug'); // 10
    mug.broken = true; // lose 10 of 90 -> 88.9%
    const r = computeScore([lamp, mug], 0);
    expect(r.percent).toBeCloseTo(80 / 90);
    expect(r.stars).toBe(2);
  });
});
