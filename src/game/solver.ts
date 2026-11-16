import Matter from 'matter-js';
import { ACTION_COST, CHAOS_SECONDS, LOGICAL_HEIGHT, LOGICAL_WIDTH, PHYSICS_HZ } from '../config/constants';
import { Attractor } from '../entities/attractor';
import { Item } from '../entities/item';
import { PhysicsWorld } from '../engine/physics';
import { Rng } from '../engine/rng';
import { buildLevel, LevelDef } from './levels';
import { computeScore } from './scoring';

const FLOOR_TOP = LOGICAL_HEIGHT - 40;

/**
 * How many random chaos seeds each plan is judged against. Play picks a fresh
 * random seed every time, so a level is only "fair" if a single prep survives a
 * spread of seeds, not just the level's own. We take the worst case.
 */
const AUDIT_SEEDS = 5;

/** A deterministic spread of chaos seeds for a level, including its own. */
function auditSeeds(level: LevelDef): number[] {
  const r = new Rng((level.seed ^ 0x9e3779b9) >>> 0);
  const seeds = [level.seed];
  while (seeds.length < AUDIT_SEEDS) seeds.push(r.int(0, 0x7fffffff));
  return seeds;
}

/** A prep plan to try: it mutates a freshly-built world and reports moves used. */
interface Plan {
  name: string;
  /** Apply prep to the world; return moves spent, or null if inapplicable/over budget. */
  apply: (world: PhysicsWorld, level: LevelDef) => number | null;
  /** Step (or -1) at which to deploy a treat during chaos. */
  treatAtStep?: number;
}

export interface SolveResult {
  stars: 0 | 1 | 2 | 3;
  percent: number;
  moves: number;
  name: string;
}

export interface LevelAudit {
  id: string;
  name: string;
  kittens: string;
  budget: number;
  itemCount: number;
  noPrepStars: number;
  noPrepPct: number;
  bestStars: number;
  bestPct: number;
  bestMoves: number;
  bestPlan: string;
  trivial: boolean; // wins (3★) with no prep
  solvable3: boolean; // a 3★ prep exists within budget
}

// --- prep helpers (replicate PrepController effects, headless) --------------

function topItems(world: PhysicsWorld): Item[] {
  return [...world.items].filter((it) => !world.isSealed(it)).sort((a, b) => b.spec.value - a.spec.value);
}

function puttyTop(world: PhysicsWorld, n: number): number {
  let c = 0;
  for (const it of topItems(world)) {
    if (c >= n) break;
    it.putty();
    c++;
  }
  return c;
}

function closeShelteringDoors(world: PhysicsWorld): number {
  let closed = 0;
  for (const d of world.doors) {
    if (world.items.some((it) => d.contains(it.body.position.x, it.body.position.y))) {
      d.closed = true;
      closed++;
    }
  }
  return closed;
}

function kittenCentroidX(world: PhysicsWorld): number {
  if (!world.kittens.length) return LOGICAL_WIDTH / 2;
  return world.kittens.reduce((s, k) => s + k.x, 0) / world.kittens.length;
}

function placeBox(world: PhysicsWorld): void {
  // Lure toward the floor beneath the kittens.
  world.addAttractor(new Attractor('box', kittenCentroidX(world), FLOOR_TOP));
}

function placeToyNearItems(world: PhysicsWorld): void {
  // Put the toy on the surface holding the most value, near its center.
  const it = topItems(world)[0];
  if (it) world.addAttractor(new Attractor('toy', it.body.position.x, it.body.position.y - it.spec.h / 2));
}

/** Relocate the floor-eligible items among `items` to safe floor spots. Returns
 *  how many were actually moved (items that cannot go on the floor are skipped). */
function relocateFar(world: PhysicsWorld, items: Item[]): number {
  const cx = kittenCentroidX(world);
  const farLeft = cx > LOGICAL_WIDTH / 2;
  // Keep items a bit off the side walls so a kitten cannot slam them into one.
  let x = farLeft ? 100 : LOGICAL_WIDTH - 100;
  const step = farLeft ? 74 : -74;
  let moved = 0;
  for (const it of items) {
    if (it.spec.floorOk === false) continue; // never set these on the floor
    Matter.Body.setPosition(it.body, { x: Math.max(90, Math.min(x, LOGICAL_WIDTH - 90)), y: FLOOR_TOP - it.spec.h / 2 - 1 });
    it.relocated = true;
    x += step;
    moved++;
  }
  return moved;
}

// --- strategy portfolio -----------------------------------------------------

function plansFor(level: LevelDef): Plan[] {
  const acts = level.actionsAvailable;
  const budget = level.moves;
  const plans: Plan[] = [{ name: 'no-prep', apply: () => 0 }];

  if (acts.includes('putty')) {
    plans.push({ name: 'putty-all', apply: (w) => puttyTop(w, budget) });
  }
  if (acts.includes('closeDoor')) {
    plans.push({
      name: 'doors+putty',
      apply: (w) => {
        const d = closeShelteringDoors(w);
        let moves = d * ACTION_COST.closeDoor;
        if (acts.includes('putty')) moves += puttyTop(w, Math.floor((budget - moves) / ACTION_COST.putty));
        return moves;
      },
    });
  }
  if (acts.includes('box')) {
    plans.push({
      name: 'box+putty',
      apply: (w) => {
        placeBox(w);
        let moves = ACTION_COST.box;
        if (acts.includes('putty')) moves += puttyTop(w, Math.floor((budget - moves) / ACTION_COST.putty));
        return moves <= budget ? moves : null;
      },
    });
  }
  if (acts.includes('toy')) {
    plans.push({
      name: 'toy+putty',
      apply: (w) => {
        placeToyNearItems(w);
        let moves = ACTION_COST.toy;
        if (acts.includes('putty')) moves += puttyTop(w, Math.floor((budget - moves) / ACTION_COST.putty));
        return moves <= budget ? moves : null;
      },
    });
  }
  if (acts.includes('treat')) {
    for (const atStep of [4 * PHYSICS_HZ, 9 * PHYSICS_HZ]) {
      plans.push({
        name: `treat@${atStep / PHYSICS_HZ}s+putty`,
        treatAtStep: atStep,
        apply: (w) => {
          let moves = ACTION_COST.treat;
          if (acts.includes('putty')) moves += puttyTop(w, Math.floor((budget - moves) / ACTION_COST.putty));
          return moves <= budget ? moves : null;
        },
      });
    }
  }
  if (acts.includes('relocate')) {
    plans.push({
      name: 'relocate-far',
      apply: (w) => relocateFar(w, topItems(w).slice(0, Math.min(budget, w.items.length))),
    });
    // Protect each top item the best way: floor-eligible ones go to the floor,
    // the rest get puttied, up to the move budget.
    if (acts.includes('putty')) {
      plans.push({
        name: 'protect-each',
        apply: (w) => {
          const items = topItems(w);
          const toFloor: Item[] = [];
          let moves = 0;
          for (const it of items) {
            if (moves >= budget) break;
            if (it.spec.floorOk !== false) {
              toFloor.push(it);
            } else {
              it.putty();
            }
            moves++;
          }
          relocateFar(w, toFloor);
          return moves;
        },
      });
    }
  }
  return plans;
}

/** Run a plan against one chaos seed. */
function runPlanSeed(level: LevelDef, plan: Plan, seed: number): SolveResult | null {
  const { world } = buildLevel(level, seed);
  const moves = plan.apply(world, level);
  if (moves === null || moves > level.moves) return null;

  world.releaseItems();
  const treatStep = plan.treatAtStep ?? -1;
  let treatDone = false;
  for (let i = 0; i < CHAOS_SECONDS * PHYSICS_HZ; i++) {
    if (!treatDone && treatStep >= 0 && i === treatStep) {
      const bowl = world.addAttractor(new Attractor('treat', LOGICAL_WIDTH / 2, FLOOR_TOP));
      bowl.available = true;
      bowl.ttl = 4 * PHYSICS_HZ;
      for (const k of world.kittens) k.lureToTreat(bowl);
      treatDone = true;
    }
    world.step();
  }
  const r = computeScore(world.items, level.moves - moves);
  return { stars: r.stars, percent: r.percent, moves, name: plan.name };
}

/**
 * Judge a plan by its WORST outcome across the audit seeds. A prep only counts
 * as a 3-star solution if it holds up no matter which random chaos play rolls.
 */
function runPlan(level: LevelDef, plan: Plan, seeds: number[]): SolveResult | null {
  let worst: SolveResult | null = null;
  for (const seed of seeds) {
    const res = runPlanSeed(level, plan, seed);
    if (!res) return null; // over budget or inapplicable; same on every seed
    if (!worst || res.stars < worst.stars || (res.stars === worst.stars && res.percent < worst.percent)) {
      worst = res;
    }
  }
  return worst;
}

/** Best prep found for a level, plus the no-prep baseline. */
export function auditLevel(level: LevelDef): LevelAudit {
  const seeds = auditSeeds(level);
  let noPrep: SolveResult = { stars: 0, percent: 0, moves: 0, name: 'no-prep' };
  let best: SolveResult = noPrep;
  for (const plan of plansFor(level)) {
    const res = runPlan(level, plan, seeds);
    if (!res) continue;
    if (plan.name === 'no-prep') noPrep = res;
    if (res.stars > best.stars || (res.stars === best.stars && res.moves < best.moves)) best = res;
  }
  return {
    id: level.id,
    name: level.name,
    kittens: level.kittens.map((k) => k.who).join(''),
    budget: level.moves,
    itemCount: level.items.length,
    noPrepStars: noPrep.stars,
    noPrepPct: noPrep.percent,
    bestStars: best.stars,
    bestPct: best.percent,
    bestMoves: best.moves,
    bestPlan: best.name,
    trivial: noPrep.stars >= 3,
    solvable3: best.stars >= 3,
  };
}
