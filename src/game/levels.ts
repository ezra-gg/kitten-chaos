import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../config/constants';
import { KITTENS, KittenId } from '../config/kittens';
import { PhysicsWorld } from '../engine/physics';
import { Rng } from '../engine/rng';
import { Door, DoorSpec } from '../entities/door';
import { ITEM_CATALOG, Item, ItemType } from '../entities/item';
import { Kitten } from '../entities/kitten';
import { ActionName } from './prep';
import level01 from '../levels/01-first-night.json';
import level02 from '../levels/02-bookshelf.json';
import level03 from '../levels/03-kitchen-counter.json';
import level04 from '../levels/04-box-day.json';
import level05 from '../levels/05-dinner-party.json';
import level06 from '../levels/06-home-office.json';

export interface LevelSurface {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: 'floor' | 'wall' | 'shelf';
}

/** An item placed at offsetX along the named surface, resting on its top. */
export interface LevelItem {
  type: ItemType;
  surface: string;
  offsetX: number;
}

/** A kitten placed on a surface (preferred) or at an absolute x/y. */
export interface LevelKitten {
  who: KittenId;
  surface?: string;
  offsetX?: number;
  x?: number;
  y?: number;
}

export interface LevelDef {
  id: string;
  name: string;
  seed: number;
  moves: number;
  surfaces: LevelSurface[];
  doors?: DoorSpec[];
  items: LevelItem[];
  kittens: LevelKitten[];
  actionsAvailable: ActionName[];
}

/** The hand-authored intro levels, in play order. */
export const HAND_LEVELS: LevelDef[] = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
] as unknown as LevelDef[];

export interface BuiltLevel {
  world: PhysicsWorld;
  rng: Rng;
  level: LevelDef;
}

const KITTEN_HALF_HEIGHT = 14;

/**
 * Construct a fresh physics world from a level definition. Pass `runSeed` to
 * drive the chaos from a different random stream than the level's own seed, so
 * each playthrough unfolds differently. Omit it (solver, generator) for the
 * deterministic baseline keyed to the level seed.
 */
export function buildLevel(level: LevelDef, runSeed?: number): BuiltLevel {
  const rng = new Rng(runSeed ?? level.seed);
  const world = new PhysicsWorld();

  // Implicit room boundaries (levels only declare their shelves/tables).
  const floorH = 40;
  const floorSpec: LevelSurface = { id: 'floor', x: 0, y: LOGICAL_HEIGHT - floorH, w: LOGICAL_WIDTH, h: floorH, kind: 'floor' };
  world.addSurface(floorSpec);
  world.addSurface({ id: 'wall-left', x: -20, y: 0, w: 20, h: LOGICAL_HEIGHT, kind: 'wall' });
  world.addSurface({ id: 'wall-right', x: LOGICAL_WIDTH, y: 0, w: 20, h: LOGICAL_HEIGHT, kind: 'wall' });

  const byId = new Map<string, LevelSurface>();
  // The floor is referenceable so items (like a floor lamp) can stand on it.
  byId.set('floor', floorSpec);
  for (const s of level.surfaces) {
    world.addSurface(s);
    byId.set(s.id, s);
  }

  for (const d of level.doors ?? []) {
    world.addDoor(new Door(d));
  }

  for (const li of level.items) {
    const s = byId.get(li.surface);
    if (!s) continue;
    const spec = ITEM_CATALOG[li.type];
    world.addItem(new Item(li.type, s.x + li.offsetX, s.y - spec.h / 2 - 1));
  }

  for (const lk of level.kittens) {
    let x = lk.x ?? 0;
    let y = lk.y ?? 0;
    if (lk.surface) {
      const s = byId.get(lk.surface);
      if (s) {
        x = s.x + (lk.offsetX ?? s.w / 2);
        y = s.y - KITTEN_HALF_HEIGHT;
      }
    }
    // Give each kitten its OWN rng, seeded from the master stream, so the two
    // cats draw independent randoms and never fall into lockstep. Still fully
    // deterministic (the master is seeded from the level seed).
    const kittenRng = new Rng(rng.int(0, 0x7fffffff));
    world.addKitten(new Kitten(KITTENS[lk.who], x, y, kittenRng, world));
  }

  return { world, rng, level };
}
