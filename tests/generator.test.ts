import { describe, expect, it } from 'vitest';
import { KITTENS } from '../src/config/kittens';
import { LOGICAL_HEIGHT } from '../src/config/constants';
import { ITEM_CATALOG } from '../src/entities/item';
import { generateLevel } from '../src/game/generator';
import { LevelDef, LevelSurface } from '../src/game/levels';

const FLOOR_TOP = LOGICAL_HEIGHT - 40;
const JUMP = KITTENS.A.jumpRange;

function surfaceGap(a: LevelSurface, b: LevelSurface): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.abs(a.y - b.y);
  return Math.hypot(dx, dy);
}

/** BFS from the floor over shelves connected within jump range. */
function reachableIds(shelves: LevelSurface[]): Set<string> {
  const reached = new Set<string>();
  const queue: LevelSurface[] = [];
  for (const s of shelves) {
    if (FLOOR_TOP - s.y <= JUMP) {
      reached.add(s.id);
      queue.push(s);
    }
  }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const s of shelves) {
      if (!reached.has(s.id) && surfaceGap(cur, s) <= JUMP) {
        reached.add(s.id);
        queue.push(s);
      }
    }
  }
  return reached;
}

describe('generateLevel', () => {
  it('is deterministic for a given seed and tier', () => {
    const a = generateLevel(12345, 3);
    const b = generateLevel(12345, 3);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('produces different layouts for different seeds', () => {
    const a = generateLevel(1, 3);
    const b = generateLevel(2, 3);
    expect(JSON.stringify(a.surfaces)).not.toEqual(JSON.stringify(b.surfaces));
  });

  it('keeps the move budget in [3, 6]', () => {
    for (let seed = 7000; seed < 7000 + 6 * 137; seed += 137) {
      const lvl = generateLevel(seed, 3);
      expect(lvl.moves).toBeGreaterThanOrEqual(3);
      expect(lvl.moves).toBeLessThanOrEqual(6);
    }
  });

  it('places every shelf within reach (no trivially-safe items)', () => {
    for (let tier = 1; tier <= 6; tier++) {
      const lvl = generateLevel(7000 + tier * 137, tier);
      const reached = reachableIds(lvl.surfaces);
      for (const s of lvl.surfaces) {
        expect(reached.has(s.id)).toBe(true);
      }
    }
  });

  it('keeps items on their shelf and non-overlapping', () => {
    const lvl: LevelDef = generateLevel(4242, 4);
    const byShelf = new Map<string, LevelSurface>();
    for (const s of lvl.surfaces) byShelf.set(s.id, s);
    const perShelf = new Map<string, { left: number; right: number }[]>();

    for (const it of lvl.items) {
      const s = byShelf.get(it.surface)!;
      const spec = ITEM_CATALOG[it.type];
      const centerX = s.x + it.offsetX;
      const left = centerX - spec.w / 2;
      const right = centerX + spec.w / 2;
      // Within the shelf bounds.
      expect(left).toBeGreaterThanOrEqual(s.x);
      expect(right).toBeLessThanOrEqual(s.x + s.w);
      // No overlap with earlier items on the same shelf.
      const list = perShelf.get(it.surface) ?? [];
      for (const other of list) {
        expect(right <= other.left || left >= other.right).toBe(true);
      }
      list.push({ left, right });
      perShelf.set(it.surface, list);
    }
  });
});
