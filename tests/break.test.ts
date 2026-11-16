import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../src/config/constants';
import { Item } from '../src/entities/item';
import { PhysicsWorld } from '../src/engine/physics';

const FLOOR_TOP = LOGICAL_HEIGHT - 40;

function world(): PhysicsWorld {
  const w = new PhysicsWorld();
  w.addSurface({ id: 'floor', x: 0, y: FLOOR_TOP, w: LOGICAL_WIDTH, h: 40, kind: 'floor' });
  w.addSurface({ id: 'wall-left', x: -20, y: 0, w: 40, h: LOGICAL_HEIGHT, kind: 'wall' });
  return w;
}

describe('break model (impact speed along the collision normal)', () => {
  it('shatters a fragile item slammed hard into a wall', () => {
    const w = world();
    const mug = w.addItem(new Item('mug', 42, FLOOR_TOP - 14 - 1));
    w.releaseItems();
    for (let i = 0; i < 20 && !mug.broken; i++) {
      Matter.Body.setVelocity(mug.body, { x: -9, y: 0 });
      w.step();
    }
    expect(mug.broken).toBe(true);
  });

  it('shatters when two items crash together fast', () => {
    const w = world();
    const a = w.addItem(new Item('mug', 200, FLOOR_TOP - 14 - 1));
    const b = w.addItem(new Item('vase', 280, FLOOR_TOP - 27 - 1));
    w.releaseItems();
    for (let i = 0; i < 40 && !a.broken && !b.broken; i++) {
      Matter.Body.setVelocity(a.body, { x: 8, y: 0 });
      Matter.Body.setVelocity(b.body, { x: -8, y: 0 });
      w.step();
    }
    expect(a.broken || b.broken).toBe(true);
  });

  it('does NOT shatter a fragile item resting gently on the floor', () => {
    const w = world();
    const mug = w.addItem(new Item('mug', 480, FLOOR_TOP - 14 - 1));
    w.releaseItems();
    for (let i = 0; i < 120; i++) w.step();
    expect(mug.broken).toBe(false);
  });
});
