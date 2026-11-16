import Matter from 'matter-js';
import { BREAK_SPEED_THRESHOLD, GRAVITY_Y, ITEM_CRASH_THRESHOLD, PHYSICS_STEP_MS } from '../config/constants';
import { Attractor } from '../entities/attractor';
import { Door } from '../entities/door';
import { Item, itemOf } from '../entities/item';
import { Kitten, kittenOf } from '../entities/kitten';
import { Surface, SurfaceSpec } from '../entities/surface';

export interface BreakEvent {
  item: Item;
  speed: number;
}

/**
 * Owns the Matter world plus the game's items and surfaces. Steps the
 * simulation at a fixed delta so runs are deterministic.
 */
export class PhysicsWorld {
  readonly engine: Matter.Engine;
  readonly surfaces: Surface[] = [];
  readonly items: Item[] = [];
  readonly kittens: Kitten[] = [];
  readonly attractors: Attractor[] = [];
  readonly doors: Door[] = [];

  /** Called whenever a fragile item shatters, for sound/incident reports. */
  onBreak: ((e: BreakEvent) => void) | undefined;

  constructor() {
    this.engine = Matter.Engine.create({
      // Fixed timestep is only deterministic with sleeping off and a constant
      // delta (see step()). Enable sleeping for performance once settled.
      enableSleeping: true,
    });
    this.engine.gravity.y = GRAVITY_Y;
    this.registerBreakDetection();
  }

  addSurface(spec: SurfaceSpec): Surface {
    const surface = new Surface(spec);
    this.surfaces.push(surface);
    Matter.Composite.add(this.engine.world, surface.body);
    return surface;
  }

  addItem(item: Item): Item {
    this.items.push(item);
    Matter.Composite.add(this.engine.world, item.body);
    return item;
  }

  addKitten(kitten: Kitten): Kitten {
    this.kittens.push(kitten);
    Matter.Composite.add(this.engine.world, kitten.body);
    return kitten;
  }

  /** Freeze all items (static) so the player can arrange them during prep. */
  freezeItems(): void {
    for (const item of this.items) {
      Matter.Body.setStatic(item.body, true);
    }
  }

  /**
   * Release items for chaos. Puttied items stay stuck until their putty fails;
   * items sealed in a closed door stay locked in place.
   */
  releaseItems(): void {
    for (const item of this.items) {
      Matter.Body.setStatic(item.body, item.puttied || this.isSealed(item));
      Matter.Sleeping.set(item.body, false);
    }
  }

  addAttractor(attractor: Attractor): Attractor {
    this.attractors.push(attractor);
    return attractor;
  }

  addDoor(door: Door): Door {
    this.doors.push(door);
    return door;
  }

  /** True if the item is sealed inside a closed door. */
  isSealed(item: Item): boolean {
    return this.doors.some((d) => d.closed && d.contains(item.body.position.x, item.body.position.y));
  }

  /** Advance the simulation by exactly one fixed step. */
  step(): void {
    // Tick timed attractors (e.g. the treat) down and expire them.
    for (const a of this.attractors) {
      if (a.ttl > 0) {
        a.ttl--;
        if (a.ttl === 0) {
          a.spent = true;
          a.available = false;
        }
      }
    }
    // Kittens decide and move (kinematically) first, including bat impulses.
    for (const kitten of this.kittens) {
      kitten.update();
    }
    // Capture approach speeds before the solver runs so impact detection uses
    // pre-collision velocity; tick down zoomies bump cooldowns.
    for (const item of this.items) {
      item.speedBeforeStep = item.body.speed;
      item.vxBeforeStep = item.body.velocity.x;
      item.vyBeforeStep = item.body.velocity.y;
      if (item.bumpCooldown > 0) item.bumpCooldown--;
    }
    Matter.Engine.update(this.engine, PHYSICS_STEP_MS);
  }

  private registerBreakDetection(): void {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const normal = pair.collision.normal;
        this.checkPairForBreak(pair.bodyA, pair.bodyB, normal);
        this.checkPairForBreak(pair.bodyB, pair.bodyA, normal);
      }
    });
  }

  /**
   * A fragile item shatters when the impact speed along the collision normal
   * crosses the threshold. This one rule covers everything: a fall onto the
   * floor (vertical impact, so low shelves stay safe), a hard slam into a wall
   * (horizontal impact), and two items crashing together (their relative
   * approach speed).
   */
  private checkPairForBreak(body: Matter.Body, other: Matter.Body, normal: Matter.Vector): void {
    const item = itemOf(body);
    if (!item || !item.spec.fragile || item.broken) return;
    if (kittenOf(other)) return; // kittens don't shatter items; batting is explicit

    const striker = itemOf(other);
    const ovx = striker ? striker.vxBeforeStep : 0;
    const ovy = striker ? striker.vyBeforeStep : 0;
    // Relative approach velocity projected onto the contact normal.
    const impact = Math.abs((item.vxBeforeStep - ovx) * normal.x + (item.vyBeforeStep - ovy) * normal.y);
    // Item-to-item crashes need a much faster hit than falls or wall slams.
    const threshold = striker ? ITEM_CRASH_THRESHOLD : BREAK_SPEED_THRESHOLD;

    if (impact >= threshold) {
      // Chain attribution: whoever set the striker in motion owns this break too.
      if (striker?.lastCulprit) item.lastCulprit = striker.lastCulprit;
      item.shatter();
      this.onBreak?.({ item, speed: impact });
    }
  }
}
