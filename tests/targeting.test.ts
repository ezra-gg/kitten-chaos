import { describe, expect, it } from 'vitest';
import { ITEM_CATALOG, Item, ItemType } from '../src/entities/item';
import { Surface } from '../src/entities/surface';
import {
  DEFAULT_WEIGHTS,
  edgeProximity,
  findSurfaceUnder,
  pickTarget,
  scoreItem,
} from '../src/ai/targeting';

/** A shelf spanning x: 100..400 at top y = 300. */
function shelf() {
  return new Surface({ id: 'shelf', x: 100, y: 300, w: 300, h: 14 });
}

/** Place an item resting on a surface top at a given x. */
function itemOnShelf(type: ItemType, x: number, s: Surface): Item {
  const h = ITEM_CATALOG[type].h;
  return new Item(type, x, s.spec.y - h / 2 - 1);
}

describe('findSurfaceUnder', () => {
  it('locates the surface an item rests on', () => {
    const s = shelf();
    const it = itemOnShelf('mug', 200, s);
    expect(findSurfaceUnder(it, [s])).toBe(s);
  });

  it('returns undefined when the item is off to the side', () => {
    const s = shelf();
    const it = itemOnShelf('mug', 600, s);
    expect(findSurfaceUnder(it, [s])).toBeUndefined();
  });

  it('ignores walls', () => {
    const wall = new Surface({ id: 'w', x: 100, y: 300, w: 300, h: 14, kind: 'wall' });
    const it = itemOnShelf('mug', 200, wall);
    expect(findSurfaceUnder(it, [wall])).toBeUndefined();
  });
});

describe('edgeProximity', () => {
  it('is higher near an edge than at the center', () => {
    const s = shelf();
    const center = itemOnShelf('mug', 250, s); // middle of 100..400
    const nearEdge = itemOnShelf('mug', 110, s);
    expect(edgeProximity(nearEdge, s)).toBeGreaterThan(edgeProximity(center, s));
  });

  it('is zero well away from either end', () => {
    const s = shelf();
    const center = itemOnShelf('mug', 250, s);
    expect(edgeProximity(center, s)).toBe(0);
  });
});

describe('scoreItem', () => {
  const s = shelf();
  const from = { x: 100, y: 286 };

  it('gives shiny items a bonus', () => {
    // vase is shiny, mug is not; compare at identical positions.
    const vase = itemOnShelf('vase', 250, s);
    const mug = itemOnShelf('mug', 250, s);
    const vaseShiny = scoreItem(from, vase, [s]);
    const vaseNoShiny = scoreItem(from, vase, [s], { ...DEFAULT_WEIGHTS, shiny: 0 });
    expect(vaseShiny).toBeGreaterThan(vaseNoShiny);
    void mug;
  });

  it('penalizes distance', () => {
    const near = itemOnShelf('mug', 130, s);
    const far = itemOnShelf('mug', 390, s);
    expect(scoreItem(from, near, [s])).toBeGreaterThan(scoreItem(from, far, [s]));
  });

  it('applies the puttied penalty after failed bats', () => {
    const it = itemOnShelf('mug', 250, s);
    const before = scoreItem(from, it, [s]);
    it.battedFailures = 1;
    const after = scoreItem(from, it, [s]);
    expect(after).toBeLessThan(before);
  });

  it('returns -Infinity for broken items', () => {
    const it = itemOnShelf('mug', 250, s);
    it.broken = true;
    expect(scoreItem(from, it, [s])).toBe(-Infinity);
  });
});

describe('pickTarget', () => {
  const s = shelf();
  const from = { x: 100, y: 286 };

  it('picks the highest-scoring reachable item', () => {
    const mug = itemOnShelf('mug', 380, s); // far, low appeal
    const lamp = itemOnShelf('lamp', 130, s); // near, high appeal
    const best = pickTarget(from, [mug, lamp], [s]);
    expect(best).toBe(lamp);
  });

  it('respects the reachability filter', () => {
    const mug = itemOnShelf('mug', 150, s);
    const lamp = itemOnShelf('lamp', 300, s);
    const best = pickTarget(from, [mug, lamp], [s], (it) => it === mug);
    expect(best).toBe(mug);
  });

  it('skips broken items', () => {
    const mug = itemOnShelf('mug', 150, s);
    const lamp = itemOnShelf('lamp', 300, s);
    lamp.broken = true;
    expect(pickTarget(from, [mug, lamp], [s])).toBe(mug);
  });

  it('returns null when nothing qualifies', () => {
    const mug = itemOnShelf('mug', 150, s);
    expect(pickTarget(from, [mug], [s], () => false)).toBeNull();
  });
});
