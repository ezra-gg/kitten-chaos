import Matter from 'matter-js';
import { KNOCKED_OVER_ANGLE, PUTTY_RESIST } from '../config/constants';
import type { KittenId } from '../config/kittens';

export type ItemType = 'mug' | 'vase' | 'laptop' | 'lamp' | 'book' | 'plant';

export interface ItemSpec {
  /** Score value. */
  value: number;
  /** Fragile items shatter on hard impact; sturdy ones only get knocked over. */
  fragile: boolean;
  /**
   * Fraction of value kept if this fragile item breaks (0 = total loss). A
   * potted plant's pot shatters but the plant is salvageable, so it keeps some.
   */
  breakRetain?: number;
  w: number;
  h: number;
  /**
   * Relative heaviness (mug = 1). A bat's knock is divided by this, so heavy
   * items (a laptop) barely move while light ones (a mug) go flying.
   */
  weight: number;
  color: string;
  /** Human-readable name for tooltips and the incident report. */
  label: string;
  /** Appeal to kittens before per-item bonuses (used from M2). */
  baseAppeal: number;
  /** Glass/metal items get a shiny bonus (used from M2). */
  shiny?: boolean;
  /** Cords/vines dangle, adding to appeal (used from M2). */
  dangle?: boolean;
}

/**
 * The catalog of item types and their properties. Values match the plan:
 * mug 10, vase 30, laptop 50, heirloom lamp 80.
 */
export const ITEM_CATALOG: Record<ItemType, ItemSpec> = {
  mug: { value: 10, fragile: true, w: 30, h: 28, weight: 1, color: '#d98c5f', label: 'Mug', baseAppeal: 4, shiny: false },
  vase: { value: 30, fragile: true, w: 32, h: 54, weight: 1.4, color: '#5fa8d9', label: 'Vase', baseAppeal: 6, shiny: true },
  laptop: { value: 50, fragile: true, w: 64, h: 42, weight: 3, color: '#b0b4bd', label: 'Laptop', baseAppeal: 5, shiny: true },
  lamp: { value: 80, fragile: true, w: 36, h: 64, weight: 2.4, color: '#e8c85f', label: 'Heirloom Lamp', baseAppeal: 7, shiny: true },
  book: { value: 5, fragile: false, w: 44, h: 16, weight: 1.8, color: '#7a9a6d', label: 'Book', baseAppeal: 2 },
  // The pot is fragile, but a broken plant is half-salvageable.
  plant: { value: 8, fragile: true, breakRetain: 0.5, w: 38, h: 44, weight: 1.6, color: '#6db58a', label: 'Plant', baseAppeal: 3, dangle: true },
};

let nextItemId = 1;

export class Item {
  readonly id: number;
  readonly type: ItemType;
  readonly spec: ItemSpec;
  readonly body: Matter.Body;

  broken = false;
  /**
   * Number of times a bat has failed to dislodge this item (e.g. it's puttied).
   * Raises the puttied_penalty in target scoring (section 4.2).
   */
  battedFailures = 0;
  /**
   * The kitten most recently responsible for this item moving - the one who
   * batted it, or (via chain reactions) batted whatever struck it. Drives the
   * incident report's "broken by X".
   */
  lastCulprit: KittenId | null = null;

  // --- Prep-phase state ---
  /** Spawn position, so a relocate can be undone. */
  readonly originalX: number;
  readonly originalY: number;
  /** True once the player has relocated this item (costs one move). */
  relocated = false;
  /** Stuck in place with museum putty. */
  puttied = false;
  /** Remaining bats the putty will resist before coming loose. */
  puttyHP = 0;
  /** Cooldown (steps) before a zoomies sprint can bump this item again. */
  bumpCooldown = 0;
  /** True while a kitten is winding up to bat it, for a telegraphing wobble. */
  wobble = false;
  /**
   * Velocity captured at the start of each physics step. The collision handler
   * reads this because by the time a collision resolves, the solver has already
   * changed the body's velocity. Used to compute true impact speed along the
   * collision normal (falls, wall slams, and item-item crashes alike).
   */
  speedBeforeStep = 0;
  vxBeforeStep = 0;
  vyBeforeStep = 0;

  constructor(type: ItemType, x: number, y: number) {
    this.id = nextItemId++;
    this.type = type;
    this.spec = ITEM_CATALOG[type];
    this.body = Matter.Bodies.rectangle(x, y, this.spec.w, this.spec.h, {
      friction: 0.6,
      frictionAir: 0.01,
      restitution: 0.1,
      density: 0.0015,
      label: `item:${type}:${this.id}`,
    });
    (this.body as unknown as { item: Item }).item = this;
    this.originalX = x;
    this.originalY = y;
  }

  /** Stick the item in place with putty. */
  putty(): void {
    this.puttied = true;
    this.puttyHP = PUTTY_RESIST;
  }

  /** Remove the putty. */
  unputty(): void {
    this.puttied = false;
    this.puttyHP = 0;
  }

  /** Return the item to where it spawned (undo a relocate). */
  resetToOriginal(): void {
    Matter.Body.setPosition(this.body, { x: this.originalX, y: this.originalY });
    Matter.Body.setAngle(this.body, 0);
    Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.body, 0);
    this.relocated = false;
  }

  /** True once a sturdy item has tipped well past upright. */
  get knockedOver(): boolean {
    if (this.spec.fragile) return false;
    const a = ((this.body.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const fromUpright = Math.min(a, Math.PI * 2 - a);
    return fromUpright > KNOCKED_OVER_ANGLE;
  }

  /** Marks the item broken. Fragile items dampen so shards settle quickly. */
  shatter(): void {
    if (this.broken) return;
    this.broken = true;
    Matter.Body.set(this.body, 'restitution', 0);
  }
}

/** Retrieve the Item attached to a body, if any. */
export function itemOf(body: Matter.Body): Item | undefined {
  return (body as unknown as { item?: Item }).item;
}
