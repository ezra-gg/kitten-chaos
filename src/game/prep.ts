import Matter from 'matter-js';
import { ACTION_COST, LOGICAL_HEIGHT } from '../config/constants';
import { Attractor } from '../entities/attractor';
import { Door } from '../entities/door';
import { Item } from '../entities/item';
import { Surface } from '../entities/surface';
import { PhysicsWorld } from '../engine/physics';

/** Pointer-mode tools (things you click/drag on the room). */
export type PrepTool = 'relocate' | 'putty' | 'box' | 'toy' | 'closeDoor';
/** Every prep action, including the treat (a purchase, not a pointer mode). */
export type ActionName = PrepTool | 'treat';

interface HistoryEntry {
  type: ActionName;
  cost: number;
  item?: Item;
  attractor?: Attractor;
  door?: Door;
  undo: () => void;
}

const FLOOR_TOP = LOGICAL_HEIGHT - 40;

/**
 * Prep-phase controller (section 3.1): the move budget, the relocate/putty/box/toy
 * tools, the treat purchase, and undo. Everything is undoable and refundable.
 */
export class PrepController {
  tool: PrepTool = 'relocate';
  treatPurchased = false;
  onChange: (() => void) | undefined;

  private history: HistoryEntry[] = [];
  private dragging: Item | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private pendingRelocate: Item | null = null;

  constructor(
    private readonly world: PhysicsWorld,
    readonly budget: number,
  ) {}

  get movesSpent(): number {
    return this.history.reduce((sum, h) => sum + h.cost, 0);
  }

  get movesRemaining(): number {
    return this.budget - this.movesSpent;
  }

  setTool(tool: PrepTool): void {
    this.tool = tool;
    this.dragging = null;
    this.pendingRelocate = null;
  }

  private itemAt(x: number, y: number): Item | undefined {
    for (let i = this.world.items.length - 1; i >= 0; i--) {
      const it = this.world.items[i];
      const p = it.body.position;
      if (Math.abs(x - p.x) <= it.spec.w / 2 + 4 && Math.abs(y - p.y) <= it.spec.h / 2 + 4) {
        return it;
      }
    }
    return undefined;
  }

  // --- Pointer handling (logical coordinates) ------------------------------

  pointerDown(x: number, y: number): void {
    switch (this.tool) {
      case 'putty':
        this.togglePutty(x, y);
        return;
      case 'box':
        this.placeBox(x);
        return;
      case 'toy':
        this.placeToy(x, y);
        return;
      case 'closeDoor':
        this.toggleDoor(x, y);
        return;
      case 'relocate':
      default:
        break;
    }
    const it = this.itemAt(x, y);
    if (!it) return;
    if (!it.relocated && this.movesRemaining <= 0) return;
    this.dragging = it;
    this.dragOffsetX = it.body.position.x - x;
    this.dragOffsetY = it.body.position.y - y;
    if (!it.relocated) this.pendingRelocate = it;
  }

  pointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    Matter.Body.setPosition(this.dragging.body, { x: x + this.dragOffsetX, y: y + this.dragOffsetY });
  }

  pointerUp(): void {
    const it = this.dragging;
    this.dragging = null;
    if (!it) return;
    Matter.Body.setPosition(it.body, this.snapToSurface(it));
    if (this.pendingRelocate === it) {
      it.relocated = true;
      this.history.push({ type: 'relocate', item: it, cost: ACTION_COST.relocate, undo: () => it.resetToOriginal() });
      this.pendingRelocate = null;
    }
    this.onChange?.();
  }

  // --- Putty ---------------------------------------------------------------

  private togglePutty(x: number, y: number): void {
    const it = this.itemAt(x, y);
    if (!it) return;
    if (it.puttied) {
      const idx = this.history.findIndex((e) => e.type === 'putty' && e.item === it);
      if (idx >= 0) {
        this.history[idx].undo();
        this.history.splice(idx, 1);
      } else {
        it.unputty();
      }
      this.onChange?.();
    } else {
      if (this.movesRemaining <= 0) return;
      it.putty();
      this.history.push({ type: 'putty', item: it, cost: ACTION_COST.putty, undo: () => it.unputty() });
      this.onChange?.();
    }
  }

  // --- Box / toy placement -------------------------------------------------

  private placeBox(x: number): void {
    if (this.movesRemaining < ACTION_COST.box) return;
    const bx = Math.max(40, Math.min(x, 920));
    const box = this.world.addAttractor(new Attractor('box', bx, FLOOR_TOP));
    this.history.push({ type: 'box', cost: ACTION_COST.box, attractor: box, undo: () => this.removeAttractor(box) });
    this.onChange?.();
  }

  private placeToy(x: number, y: number): void {
    if (this.movesRemaining < ACTION_COST.toy) return;
    const p = this.snapPointToSurface(x, y);
    const toy = this.world.addAttractor(new Attractor('toy', p.x, p.y));
    this.history.push({ type: 'toy', cost: ACTION_COST.toy, attractor: toy, undo: () => this.removeAttractor(toy) });
    this.onChange?.();
  }

  private removeAttractor(a: Attractor): void {
    const idx = this.world.attractors.indexOf(a);
    if (idx >= 0) this.world.attractors.splice(idx, 1);
  }

  // --- Doors ---------------------------------------------------------------

  private toggleDoor(x: number, y: number): void {
    const d = this.world.doors.find((dd) => dd.contains(x, y));
    if (!d) return;
    if (d.closed) {
      const idx = this.history.findIndex((e) => e.type === 'closeDoor' && e.door === d);
      if (idx >= 0) {
        this.history[idx].undo();
        this.history.splice(idx, 1);
      } else {
        d.closed = false;
      }
      this.onChange?.();
    } else {
      if (this.movesRemaining < ACTION_COST.closeDoor) return;
      d.closed = true;
      this.history.push({ type: 'closeDoor', cost: ACTION_COST.closeDoor, door: d, undo: () => (d.closed = false) });
      this.onChange?.();
    }
  }

  // --- Treat purchase ------------------------------------------------------

  buyTreat(): void {
    if (this.treatPurchased) {
      const idx = this.history.findIndex((e) => e.type === 'treat');
      if (idx >= 0) {
        this.history[idx].undo();
        this.history.splice(idx, 1);
      }
    } else {
      if (this.movesRemaining < ACTION_COST.treat) return;
      this.treatPurchased = true;
      this.history.push({ type: 'treat', cost: ACTION_COST.treat, undo: () => (this.treatPurchased = false) });
    }
    this.onChange?.();
  }

  undoLast(): void {
    const entry = this.history.pop();
    if (!entry) return;
    entry.undo();
    this.onChange?.();
  }

  // --- Snapping ------------------------------------------------------------

  private snapToSurface(it: Item): { x: number; y: number } {
    const allowFloor = it.spec.floorOk !== false;
    const best = this.nearestSurface(it.body.position.x, it.body.position.y, it.spec.h / 2, allowFloor);
    if (!best) return { x: it.body.position.x, y: it.body.position.y };
    const left = best.spec.x + it.spec.w / 2;
    const right = best.spec.x + best.spec.w - it.spec.w / 2;
    return { x: Math.max(left, Math.min(it.body.position.x, right)), y: best.spec.y - it.spec.h / 2 - 0.5 };
  }

  private snapPointToSurface(x: number, y: number): { x: number; y: number } {
    const s = this.nearestSurface(x, y, 0);
    if (!s) return { x, y: FLOOR_TOP };
    const left = s.spec.x + 10;
    const right = s.spec.x + s.spec.w - 10;
    return { x: Math.max(left, Math.min(x, right)), y: s.spec.y };
  }

  /** A surface sitting inside a cabinet opening; not a valid relocate target. */
  private insideCabinet(s: Surface): boolean {
    const cx = s.spec.x + s.spec.w / 2;
    const cy = s.spec.y;
    return this.world.doors.some((d) => d.contains(cx, cy));
  }

  private nearestSurface(x: number, y: number, halfH: number, allowFloor = true): Surface | undefined {
    const bottom = y + halfH;
    let best: Surface | undefined;
    let bestScore = Infinity;
    for (const s of this.world.surfaces) {
      if (s.kind === 'wall') continue;
      // Some items (a laptop, a mug) are never set on the floor.
      if (s.kind === 'floor' && !allowFloor) continue;
      // Can't stuff the whole apartment into a cabinet: its shelves are off-limits
      // as relocate targets, so a closed door only protects its intended contents.
      if (this.insideCabinet(s)) continue;
      const withinX = x >= s.spec.x && x <= s.spec.x + s.spec.w;
      const dy = s.spec.y - bottom;
      const horiz = withinX ? 0 : Math.min(Math.abs(x - s.spec.x), Math.abs(x - (s.spec.x + s.spec.w))) * 2;
      const abovePenalty = dy < -24 ? 1000 : 0;
      const score = Math.abs(dy) + horiz + abovePenalty;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  }
}
