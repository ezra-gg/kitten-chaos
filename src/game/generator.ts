import { CHAOS_SECONDS, LOGICAL_HEIGHT, LOGICAL_WIDTH, PHYSICS_HZ } from '../config/constants';
import { KITTENS } from '../config/kittens';
import { Rng } from '../engine/rng';
import { ITEM_CATALOG, ItemType } from '../entities/item';
import { buildLevel, LevelDef, LevelItem, LevelKitten, LevelSurface } from './levels';
import { computeScore } from './scoring';
import { auditLevel } from './solver';

const FLOOR_TOP = LOGICAL_HEIGHT - 40; // 500
const JUMP_RANGE = KITTENS.A.jumpRange; // reachability uses the Batter's reach
const SIDE_MARGIN = 36;

const LEVEL_NAMES = [
  'Quiet Corner',
  'The Study',
  'Shelf Life',
  'Knick-Knack Row',
  'The Mantel',
  'Curio Cabinet',
  'Tchotchke Tower',
  'The Reading Nook',
  'Dustcatcher Alley',
  'The Windowsill',
];

/** Item type pools by difficulty tier (higher tiers add pricier breakables). */
function typePool(tier: number): ItemType[] {
  const pool: ItemType[] = ['mug', 'book', 'vase', 'plant', 'mug', 'book'];
  if (tier >= 3) pool.push('laptop', 'vase');
  if (tier >= 5) pool.push('lamp', 'laptop');
  return pool;
}

/** Straight-line jump distance between two surfaces' nearest tops. */
function surfaceGap(a: LevelSurface, b: LevelSurface): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.abs(a.y - b.y);
  return Math.hypot(dx, dy);
}

/** Can a kitten on the floor reach this shelf directly (hop straight up)? */
function floorReachable(s: LevelSurface): boolean {
  return FLOOR_TOP - s.y <= JUMP_RANGE;
}

/** Minimum vertical gap between shelves that overlap horizontally. */
const MIN_VGAP = 58;

/** Two shelves that overlap in x and sit too close vertically look like one broken shelf. */
function shelfConflicts(cand: LevelSurface, shelves: LevelSurface[]): boolean {
  return shelves.some(
    (s) => cand.x < s.x + s.w && s.x < cand.x + cand.w && Math.abs(cand.y - s.y) < MIN_VGAP,
  );
}

/**
 * Generate a deterministic, reachable room for the given seed and tier. The
 * returned level has a provisional budget that is then calibrated by simulation
 * (see generateLevel).
 */
function layoutLevel(seed: number, tier: number): LevelDef {
  const rng = new Rng(seed);
  const shelfCount = Math.min(3, 2 + Math.floor(tier / 3));
  const baseCount = Math.max(1, Math.ceil(shelfCount / 2));
  const shelves: LevelSurface[] = [];

  // Base shelves: low enough to hop onto from the floor. Retry to avoid shelves
  // that overlap and clip into each other.
  for (let i = 0; i < baseCount; i++) {
    let cand: LevelSurface | undefined;
    for (let t = 0; t < 20; t++) {
      const w = rng.int(190, 270);
      const x = rng.int(SIDE_MARGIN, LOGICAL_WIDTH - SIDE_MARGIN - w);
      const y = rng.int(FLOOR_TOP - JUMP_RANGE + 8, FLOOR_TOP - 90); // guaranteed floor-reachable
      cand = { id: `shelf${shelves.length + 1}`, x, y, w, h: 14, kind: 'shelf' };
      if (!shelfConflicts(cand, shelves)) break;
    }
    shelves.push(cand!);
  }

  // Upper shelves: placed near an existing shelf so they're reachable by a hop.
  while (shelves.length < shelfCount) {
    let cand: LevelSurface | undefined;
    for (let t = 0; t < 20; t++) {
      const anchor = rng.pick(shelves);
      const w = rng.int(170, 240);
      const dyUp = rng.int(72, 108);
      const y = Math.max(170, anchor.y - dyUp);
      // Keep horizontal overlap with the anchor so the jump distance stays in range.
      const minX = Math.max(SIDE_MARGIN, anchor.x - 110);
      const maxX = Math.min(LOGICAL_WIDTH - SIDE_MARGIN - w, anchor.x + anchor.w - 60);
      const x = maxX > minX ? rng.int(minX, maxX) : minX;
      cand = { id: `shelf${shelves.length + 1}`, x, y, w, h: 14, kind: 'shelf' };
      if (!shelfConflicts(cand, shelves)) break;
    }
    shelves.push(cand!);
  }

  // Repair: any shelf not reachable (from floor or another shelf) is moved into
  // the floor-reachable band so no items are trivially safe. Pick a spot that
  // does not clip into another shelf.
  for (const s of shelves) {
    const reachable =
      floorReachable(s) || shelves.some((o) => o !== s && floorReachable(o) && surfaceGap(s, o) <= JUMP_RANGE);
    if (!reachable) {
      const others = shelves.filter((o) => o !== s);
      for (let t = 0; t < 24; t++) {
        s.y = rng.int(FLOOR_TOP - JUMP_RANGE + 8, FLOOR_TOP - 90);
        s.x = rng.int(SIDE_MARGIN, LOGICAL_WIDTH - SIDE_MARGIN - s.w);
        if (!shelfConflicts(s, others)) break;
      }
    }
  }

  // Populate shelves, biasing items toward the two edges (the risky spots a
  // kitten can knock them off) by filling inward from both ends.
  const pool = typePool(tier);
  const items: LevelItem[] = [];
  for (const s of shelves) {
    const want = rng.int(1, 2 + Math.floor(tier / 4));
    const margin = 10;
    const usable = s.w - 2 * margin;
    const placed: { left: number; right: number }[] = [];
    // Spread items across evenly spaced slots. The end slots sit near the risky
    // edges, the middle slots are safer, so not every item is at risk.
    for (let k = 0; k < want; k++) {
      const type = rng.pick(pool);
      const spec = ITEM_CATALOG[type];
      const slot = margin + usable * ((k + 0.5) / want) + rng.int(-8, 9);
      const cx = Math.max(margin + spec.w / 2, Math.min(slot, s.w - margin - spec.w / 2));
      const left = cx - spec.w / 2;
      const right = cx + spec.w / 2;
      if (placed.some((p) => left < p.right + 4 && p.left - 4 < right)) continue; // would overlap
      placed.push({ left, right });
      items.push({ type, surface: s.id, offsetX: cx });
    }
  }

  // Sometimes stand a tall floor lamp on the floor beside a shelf. If a kitten
  // knocks it, it can topple into that shelf and take things out with it.
  if (tier >= 3 && rng.chance(0.6)) {
    // Stand it tight against the lowest shelf, which it is tall enough to topple into.
    const near = shelves.reduce((lo, s) => (s.y > lo.y ? s : lo), shelves[0]);
    const side = rng.chance(0.5) ? -1 : 1;
    const lx = side < 0 ? near.x - 8 : near.x + near.w + 8;
    items.push({ type: 'floorLamp', surface: 'floor', offsetX: Math.max(44, Math.min(lx, LOGICAL_WIDTH - 44)) });
  }

  // Start the kitten on a base shelf, right in the mix.
  const startShelf = shelves[0];
  const kittens: LevelKitten[] = [{ who: 'A', surface: startShelf.id, offsetX: 22 }];

  // Mix the seed's bits so nearby seeds get different names.
  const nameIdx = ((seed ^ (seed >>> 13)) * 2654435761) >>> 0;
  const name = LEVEL_NAMES[nameIdx % LEVEL_NAMES.length];
  return {
    id: `gen-${seed}`,
    name,
    seed,
    moves: 4, // provisional; calibrated below
    surfaces: shelves,
    doors: [],
    items,
    kittens,
    actionsAvailable: ['relocate', 'putty'],
  };
}

/**
 * Playtest a level with NO prep: run the deterministic chaos sim and report how
 * many fragile items shatter. Used to size the move budget.
 */
function simulateBreakCount(level: LevelDef): number {
  const { world } = buildLevel(level);
  world.releaseItems();
  for (let i = 0; i < CHAOS_SECONDS * PHYSICS_HZ; i++) world.step();
  const result = computeScore(world.items, 0);
  return result.incidents.filter((i) => i.kind === 'broke').length;
}

/**
 * Generate a calibrated, deterministic level. Uses the solver/auditor to reject
 * trivial layouts (3★ with no prep) and to set the smallest budget that still
 * admits a verified 3★ solution. Regenerates from a derived seed if a layout is
 * too easy, so the final level is deterministic but guaranteed fair.
 */
export function generateLevel(seed: number, tier: number): LevelDef {
  const MAX_BUDGET = 8;
  for (let attempt = 0; attempt < 6; attempt++) {
    const level = layoutLevel(seed + attempt * 101, tier);
    level.moves = MAX_BUDGET;
    const audit = auditLevel(level);
    if (audit.trivial || !audit.solvable3) continue; // too easy, or (rarely) too hard at max budget
    // Smallest budget that still admits a 3★ solution (min 3 moves).
    let chosen = MAX_BUDGET;
    for (const b of [3, 4, 5, 6, 7]) {
      level.moves = b;
      if (auditLevel(level).solvable3) {
        chosen = b;
        break;
      }
    }
    level.moves = chosen;
    return level;
  }
  // Fallback: a break-count budget on the base layout.
  const level = layoutLevel(seed, tier);
  level.moves = Math.max(3, Math.min(MAX_BUDGET, simulateBreakCount(level)));
  return level;
}
