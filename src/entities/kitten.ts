import Matter from 'matter-js';
import { ZOOM_SLAM_STRENGTH } from '../config/constants';
import { KittenId, KittenPersonality } from '../config/kittens';
import { Rng } from '../engine/rng';
import { KittenState, TIMING } from '../ai/states';
import { findSurfaceUnder, pickTarget } from '../ai/targeting';
import { Attractor } from './attractor';
import { Item } from './item';
import { Surface } from './surface';

/** What a kitten needs to know about the world to make decisions. */
export interface KittenWorld {
  items: Item[];
  surfaces: Surface[];
  attractors: Attractor[];
  isSealed(item: Item): boolean;
}

/**
 * A kitten is driven by a small state machine (section 4.1). Movement is kinematic -
 * we own the body's position and move it along surfaces and jump arcs directly
 * (project plan section 9: steering a rigid body with forces gets messy). The body is
 * a static sensor so it never physically disturbs items; batting applies an
 * explicit impulse instead.
 */
export class Kitten {
  readonly who: KittenId;
  readonly cfg: KittenPersonality;
  readonly body: Matter.Body;
  readonly w = 38;
  readonly h = 28;

  state: KittenState = 'nap';
  facing: 1 | -1 = 1;
  /** 0..1 wiggle animation phase, for the renderer. */
  wigglePhase = 0;

  private timer = 0;
  private target: Item | null = null;
  private walkGoalX = 0;
  private wiggleTimer = -1;
  private batsDone = 0;
  private batPause = 0;
  private zoomDir: 1 | -1 = 1;
  private zoomTimer = 0;
  private boredom = 0;
  private surfaceTimer = 0;
  private lastSurface: Surface | undefined;
  private lure: Attractor | null = null;
  private distractPhase: 'travel' | 'hold' = 'travel';
  private holdTimer = 0;
  private travel: { fromX: number; fromY: number; toX: number; toY: number; peak: number; t: number; duration: number } | null = null;
  private jump: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    peak: number;
    t: number;
    duration: number;
  } | null = null;

  constructor(
    cfg: KittenPersonality,
    x: number,
    y: number,
    private readonly rng: Rng,
    private readonly world: KittenWorld,
  ) {
    this.cfg = cfg;
    this.who = cfg.id;
    this.body = Matter.Bodies.rectangle(x, y, this.w, this.h, {
      isStatic: true,
      isSensor: true,
      label: `kitten:${cfg.id}`,
    });
    (this.body as unknown as { kitten: Kitten }).kitten = this;
    this.timer = this.rng.int(TIMING.napMin, TIMING.napMax);
  }

  get x(): number {
    return this.body.position.x;
  }
  get y(): number {
    return this.body.position.y;
  }

  private setPos(x: number, y: number): void {
    Matter.Body.setPosition(this.body, { x, y });
  }

  /** The surface the kitten is currently standing on, by geometry. */
  standingSurface(): Surface | undefined {
    const bottom = this.y + this.h / 2;
    for (const s of this.world.surfaces) {
      if (s.kind === 'wall') continue;
      if (this.x < s.spec.x || this.x > s.spec.x + s.spec.w) continue;
      if (Math.abs(s.spec.y - bottom) <= 4) return s;
    }
    return undefined;
  }

  private canReach(item: Item, standing: Surface | undefined): boolean {
    if (this.world.isSealed(item)) return false; // locked in a closed cabinet
    if (item.puttied) return false; // stuck down; a smart cat won't bother
    if (item.battedFailures >= TIMING.abandonAfter) return false; // can't budge it; move on
    const s = findSurfaceUnder(item, this.world.surfaces);
    if (!s) return false;
    if (s === standing) return true;
    return this.canJumpTo(s);
  }

  private canJumpTo(s: Surface): boolean {
    const cx = Math.max(s.spec.x, Math.min(this.x, s.spec.x + s.spec.w));
    const cy = s.spec.y;
    return Math.hypot(cx - this.x, cy - this.y) <= this.cfg.jumpRange;
  }

  // --- Main per-step update ------------------------------------------------

  update(): void {
    this.surfaceTimer++; // time spent on the current surface; reset on landing
    switch (this.state) {
      case 'nap':
        this.napStep();
        break;
      case 'wander':
        this.wanderStep();
        break;
      case 'jump':
        this.jumpStep();
        break;
      case 'stalk':
        this.stalkStep();
        break;
      case 'bat':
        this.batStep();
        break;
      case 'zoomies':
        this.zoomiesStep();
        break;
      case 'distracted':
        this.distractedStep();
        break;
      default:
        this.toWander();
        break;
    }
  }

  /** Force this kitten to drop everything and run to the treat (section 3.1). */
  lureToTreat(treat: Attractor): void {
    if (this.lure === treat) return;
    this.beginDistraction(treat);
  }

  private napStep(): void {
    if (--this.timer <= 0) this.toWander();
  }

  private toWander(): void {
    if (this.target) this.target.wobble = false;
    this.state = 'wander';
    this.target = null;
    this.wiggleTimer = -1;
    this.pickWanderGoal();
  }

  /** Curl up for a nap, e.g. when nothing reachable is left to knock over. */
  private toNap(): void {
    if (this.target) this.target.wobble = false;
    this.state = 'nap';
    this.target = null;
    this.wiggleTimer = -1;
    this.timer = this.rng.int(TIMING.napMin, TIMING.napMax);
  }

  private pickWanderGoal(): void {
    const s = this.standingSurface();
    if (s) {
      const left = s.spec.x + this.w / 2;
      const right = s.spec.x + s.spec.w - this.w / 2;
      this.walkGoalX = this.rng.range(left, right);
    }
    this.timer = this.rng.int(TIMING.wanderMin, TIMING.wanderMax);
  }

  private wanderStep(): void {
    const s = this.standingSurface();
    if (!s) {
      // Not on a surface (shouldn't happen for M2); settle to nearest.
      this.toWander();
      return;
    }

    // A box or toy nearby pulls the kitten away from mischief.
    const lure = this.findDistraction();
    if (lure) {
      this.beginDistraction(lure);
      return;
    }

    const reached = this.walkToward(this.walkGoalX, s);

    if (--this.timer <= 0 || reached) {
      // The Zoomer breaks into zoomies often, the Batter rarely, but only when
      // there is actually something on this surface to slam. No point sprinting
      // back and forth across an empty shelf.
      const prey = (it: Item) => this.canReach(it, s);
      const hasLocalPrey = this.world.items.some((it) => findSurfaceUnder(it, this.world.surfaces) === s && prey(it));
      if (hasLocalPrey && this.rng.chance(this.cfg.zoomiesChance)) {
        this.beginZoomies();
        return;
      }

      // After a long stint on one surface, wander off to a livelier one even if
      // something is still here, so she does not camp a single shelf all round.
      if (this.surfaceTimer > TIMING.restlessSteps) {
        const dest = this.pickExploreSurface(s);
        if (dest) {
          this.boredom = 0;
          if (this.canJumpTo(dest)) this.beginJump(dest, null);
          else this.walkGoalX = this.jumpOffToward(dest, s);
          return;
        }
      }

      const target = pickTarget({ x: this.x, y: this.y }, this.world.items, this.world.surfaces, prey);
      if (target) {
        this.boredom = 0;
        const ts = findSurfaceUnder(target, this.world.surfaces);
        if (ts === s) {
          this.target = target;
          this.state = 'stalk';
          this.wiggleTimer = -1;
          return;
        }
        if (ts && this.canJumpTo(ts)) {
          this.beginJump(ts, target);
          return;
        }
      }
      // Nothing to chase from right here. Find a surface that still has unbroken
      // things and that this shelf can launch to, then walk to the launch point
      // before hopping. A higher or sideways shelf is often only in range from
      // one end, so she has to reposition first. If nothing reachable is left to
      // knock over, settle down instead of pacing a dead end.
      if (++this.boredom >= TIMING.boredomCycles) {
        this.boredom = 0;
        const dest = this.pickExploreSurface(s);
        if (!dest) {
          this.toNap();
        } else if (this.canJumpTo(dest)) {
          this.beginJump(dest, null);
        } else {
          this.walkGoalX = this.jumpOffToward(dest, s); // get to the launch end
        }
        return;
      }
      this.pickWanderGoal();
    }
  }

  /**
   * The best surface to hop to when the current one is exhausted, judged by
   * whether this shelf can launch to it from its best end (not just from where
   * she happens to stand). Each candidate is scored by how many unbroken items
   * it puts in reach, so she steps toward the action and never bounces onto an
   * empty shelf or a floor of already-broken things. Undefined when nothing
   * qualifies.
   */
  private pickExploreSurface(current: Surface): Surface | undefined {
    let best: Surface | undefined;
    let bestScore = 0;
    const tied: Surface[] = [];
    for (const s of this.world.surfaces) {
      if (s.kind === 'wall' || s === current || !this.canHopBetween(current, s)) continue;
      let score = this.intactItemsInReachFrom(s);
      if (score <= 0) continue; // a dead end leads to nothing worth batting
      if (s === this.lastSurface) score -= 0.5; // don't bounce straight back
      if (score > bestScore) {
        bestScore = score;
        best = s;
        tied.length = 0;
        tied.push(s);
      } else if (score === bestScore) {
        tied.push(s);
      }
    }
    return tied.length > 1 ? tied[this.rng.int(0, tied.length)] : best;
  }

  /** Count unbroken, battable items on `from` or on a surface one hop from it. */
  private intactItemsInReachFrom(from: Surface): number {
    let n = 0;
    for (const it of this.world.items) {
      if (it.broken || it.puttied || this.world.isSealed(it)) continue;
      if (it.battedFailures >= TIMING.abandonAfter) continue; // given up on this one
      const s = findSurfaceUnder(it, this.world.surfaces);
      if (!s) continue;
      if (s === from || this.canHopBetween(from, s)) n++;
    }
    return n;
  }

  /** The x on `from` from which the jump to `dest` is shortest (the launch end). */
  private jumpOffToward(dest: Surface, from: Surface): number {
    const left = from.spec.x + this.w / 2;
    const right = from.spec.x + from.spec.w - this.w / 2;
    const destCenter = dest.spec.x + dest.spec.w / 2;
    return Math.max(left, Math.min(destCenter, right));
  }

  /** Whether, standing at `from`'s best launch point, she could reach `dest`. */
  private canHopBetween(from: Surface, dest: Surface): boolean {
    const x = this.jumpOffToward(dest, from);
    const y = from.spec.y - this.h / 2;
    const cx = Math.max(dest.spec.x, Math.min(x, dest.spec.x + dest.spec.w));
    const cy = dest.spec.y;
    return Math.hypot(cx - x, cy - y) <= this.cfg.jumpRange;
  }

  /** Move toward a target x along a surface. Returns true when essentially there. */
  private walkToward(targetX: number, s: Surface): boolean {
    const dx = targetX - this.x;
    const dir: 1 | -1 = dx >= 0 ? 1 : -1;
    this.facing = dir;
    const left = s.spec.x + this.w / 2;
    const right = s.spec.x + s.spec.w - this.w / 2;
    const step = Math.min(Math.abs(dx), this.cfg.walkSpeed);
    const nx = Math.max(left, Math.min(this.x + dir * step, right));
    const ny = s.spec.y - this.h / 2;
    this.setPos(nx, ny);
    return Math.abs(targetX - nx) < 1 || nx === left || nx === right;
  }

  private beginJump(targetSurface: Surface, target: Item | null): void {
    this.lastSurface = this.standingSurface(); // remember where we came from
    const toX = target
      ? Math.max(targetSurface.spec.x + this.w / 2, Math.min(target.body.position.x, targetSurface.spec.x + targetSurface.spec.w - this.w / 2))
      : targetSurface.spec.x + targetSurface.spec.w / 2;
    const toY = targetSurface.spec.y - this.h / 2;
    const dist = Math.hypot(toX - this.x, toY - this.y);
    const duration = Math.round(Math.max(18, Math.min(42, dist / 6)));
    // Arc peak rises above the higher of the two endpoints.
    const peak = 60 + Math.max(0, this.y - toY) * 0.4;
    this.jump = { fromX: this.x, fromY: this.y, toX, toY, peak, t: 0, duration };
    this.facing = toX >= this.x ? 1 : -1;
    this.target = target;
    this.state = 'jump';
  }

  private jumpStep(): void {
    const j = this.jump;
    if (!j) {
      this.toWander();
      return;
    }
    j.t++;
    const u = Math.min(1, j.t / j.duration);
    const x = j.fromX + (j.toX - j.fromX) * u;
    const baseY = j.fromY + (j.toY - j.fromY) * u;
    const y = baseY - j.peak * Math.sin(Math.PI * u);
    this.setPos(x, y);
    if (u >= 1) {
      this.jump = null;
      this.boredom = 0; // fresh surface, fresh start
      this.surfaceTimer = 0;
      if (this.target && !this.target.broken) {
        this.state = 'stalk';
        this.wiggleTimer = -1;
      } else {
        this.toWander();
      }
    }
  }

  private stalkStep(): void {
    const s = this.standingSurface();
    if (!this.target || this.target.broken || !s) {
      this.toWander();
      return;
    }
    const ts = findSurfaceUnder(this.target, this.world.surfaces);
    if (ts !== s) {
      // Target fell away or moved to another surface.
      this.toWander();
      return;
    }
    const tx = this.target.body.position.x;
    const batRange = this.w / 2 + this.target.spec.w / 2 + 6;
    if (Math.abs(tx - this.x) > batRange) {
      this.walkToward(tx, s);
      return;
    }
    // In range: wiggle, then bat.
    this.facing = tx >= this.x ? 1 : -1;
    this.target.wobble = true; // telegraph the incoming bat
    if (this.wiggleTimer < 0) this.wiggleTimer = TIMING.wiggle;
    this.wigglePhase = 1 - this.wiggleTimer / TIMING.wiggle;
    if (--this.wiggleTimer <= 0) {
      this.target.wobble = false;
      this.state = 'bat';
      this.batsDone = 0;
      this.batPause = 0;
      this.wigglePhase = 0;
    }
  }

  // --- Distracted (box / toy / treat) -------------------------------------

  private findDistraction(): Attractor | null {
    let best: Attractor | null = null;
    let bestScore = -Infinity;
    for (const a of this.world.attractors) {
      if (!a.available || a.spent) continue;
      if (a.kind === 'treat') return a; // treats override everything
      const d = Math.hypot(a.x - this.x, a.y - this.y);
      if (d > a.radius) continue;
      const score = a.radius - d;
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return best;
  }

  private holdStepsFor(a: Attractor): number {
    switch (a.kind) {
      case 'box':
        // The Batter is a sucker for the box: stays the full 10s (section 4.3).
        return (this.who === 'A' ? 10 : 8) * 60;
      case 'toy':
        // The Zoomer can't resist the toy: double duration.
        return (this.who === 'B' ? 10 : 5) * 60;
      case 'treat':
        return 4 * 60;
    }
  }

  private beginDistraction(a: Attractor): void {
    this.lure = a;
    if (a.kind !== 'treat') a.available = false; // claimed by this kitten
    this.state = 'distracted';
    this.distractPhase = 'travel';
    const toX = a.x;
    const toY = a.y - this.h / 2;
    const dist = Math.hypot(toX - this.x, toY - this.y);
    const duration = Math.round(Math.max(14, Math.min(50, dist / 7)));
    const peak = 36 + Math.max(0, this.y - toY) * 0.3;
    this.travel = { fromX: this.x, fromY: this.y, toX, toY, peak, t: 0, duration };
    this.facing = toX >= this.x ? 1 : -1;
    this.holdTimer = this.holdStepsFor(a);
  }

  private distractedStep(): void {
    const a = this.lure;
    if (!a) {
      this.toWander();
      return;
    }
    if (this.distractPhase === 'travel') {
      const t = this.travel;
      if (!t) {
        this.distractPhase = 'hold';
        return;
      }
      t.t++;
      const u = Math.min(1, t.t / t.duration);
      const x = t.fromX + (t.toX - t.fromX) * u;
      const baseY = t.fromY + (t.toY - t.fromY) * u;
      this.setPos(x, baseY - t.peak * Math.sin(Math.PI * u));
      if (u >= 1) this.distractPhase = 'hold';
      return;
    }

    // Holding at the lure.
    this.setPos(a.x, a.y - this.h / 2);
    if (a.kind === 'toy') this.wigglePhase = (this.wigglePhase + 0.12) % 1;

    // Treat expired out from under us.
    if (a.kind === 'treat' && (a.spent || !a.available)) {
      this.endDistraction();
      return;
    }
    if (--this.holdTimer <= 0) {
      if (a.kind === 'box' || a.kind === 'toy') {
        a.spent = true; // sat in / batted away
      }
      this.endDistraction();
    }
  }

  private endDistraction(): void {
    this.wigglePhase = 0;
    this.lure = null;
    this.travel = null;
    this.toWander();
  }

  private beginZoomies(): void {
    this.state = 'zoomies';
    this.zoomTimer = TIMING.zoomiesSteps;
    this.zoomDir = this.rng.chance(0.5) ? 1 : -1;
  }

  /**
   * Zoomies: sprint back and forth along the current surface, body-slamming any
   * item in the path off it (section 4.1). This is the Zoomer's signature chaos.
   */
  private zoomiesStep(): void {
    const s = this.standingSurface();
    if (!s) {
      this.toWander();
      return;
    }
    const speed = this.cfg.walkSpeed * TIMING.zoomSpeedMul;
    const left = s.spec.x + this.w / 2;
    const right = s.spec.x + s.spec.w - this.w / 2;
    let nx = this.x + this.zoomDir * speed;
    if (nx <= left) {
      nx = left;
      this.zoomDir = 1;
    } else if (nx >= right) {
      nx = right;
      this.zoomDir = -1;
    }
    this.facing = this.zoomDir;
    this.setPos(nx, s.spec.y - this.h / 2);

    // Bump anything on this surface we run through.
    for (const item of this.world.items) {
      if (item.broken) continue;
      if (findSurfaceUnder(item, this.world.surfaces) !== s) continue;
      if (Math.abs(item.body.position.x - this.x) < this.w / 2 + item.spec.w / 2) {
        if (item.puttied || this.world.isSealed(item)) continue; // held or sealed away
        if (item.bumpCooldown > 0) continue; // already knocked this pass
        const knock = ZOOM_SLAM_STRENGTH / item.spec.weight;
        Matter.Body.setVelocity(item.body, { x: this.zoomDir * knock, y: -1 });
        Matter.Sleeping.set(item.body, false);
        item.lastCulprit = this.who;
        item.bumpCooldown = 16; // ~0.27s before this item can be bumped again
      }
    }

    if (--this.zoomTimer <= 0) this.toWander();
  }

  private batStep(): void {
    if (!this.target || this.target.broken) {
      this.toWander();
      return;
    }
    if (this.batPause > 0) {
      this.batPause--;
      return;
    }
    const resisted = this.doBat(this.target);
    this.batsDone++;
    this.batPause = TIMING.batPause;
    if (resisted) {
      // The putty held: one frustrated swat, then give up and move on. The
      // puttied-penalty (section 4.2) steers the kitten to a different target.
      this.toWander();
      return;
    }
    if (this.batsDone >= TIMING.maxBats) {
      // Couldn't dislodge it in a full sequence, so lose interest instead of
      // bashing the same immovable object forever. The accumulating
      // puttied/failed penalty (section 4.2) steers the kitten to other targets.
      this.target.battedFailures++;
      this.toWander();
    }
  }

  /** Perform one bat. Returns true if the item resisted (putty held). */
  private doBat(item: Item): boolean {
    // Puttied items resist a couple of bats, then come loose (section 3.1).
    if (item.puttied) {
      item.puttyHP--;
      item.battedFailures++;
      if (item.puttyHP <= 0) {
        item.unputty();
        Matter.Body.setStatic(item.body, false);
      }
      return true;
    }

    // Always shove the item away from the cat, toward the side it approached
    // from. This keeps the nudge predictable. The cat pushes the item forward
    // and never hooks it back past itself.
    const dir: 1 | -1 = item.body.position.x - this.x >= 0 ? 1 : -1;
    this.facing = dir;
    // Impulse divided by weight: heavy items barely budge, light ones fly.
    const knock = this.cfg.batStrength / item.spec.weight;
    Matter.Body.setVelocity(item.body, { x: dir * knock, y: -1.5 / Math.sqrt(item.spec.weight) });
    Matter.Sleeping.set(item.body, false);
    item.lastCulprit = this.who;
    item.investigateTimer = 180; // stays interesting for ~3s so the cat follows it
    return false;
  }
}

/** Retrieve the Kitten attached to a body, if any. */
export function kittenOf(body: Matter.Body): Kitten | undefined {
  return (body as unknown as { kitten?: Kitten }).kitten;
}
