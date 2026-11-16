import { describe, expect, it } from 'vitest';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, PHYSICS_HZ } from '../src/config/constants';
import { KITTENS } from '../src/config/kittens';
import { Door } from '../src/entities/door';
import { Item } from '../src/entities/item';
import { Kitten } from '../src/entities/kitten';
import { PhysicsWorld } from '../src/engine/physics';
import { Rng } from '../src/engine/rng';

/** A cabinet shelf with a laptop, a door over it, and a kitten that can reach it. */
function cabinetWorld() {
  const world = new PhysicsWorld();
  world.addSurface({ id: 'floor', x: 0, y: LOGICAL_HEIGHT - 40, w: LOGICAL_WIDTH, h: 40, kind: 'floor' });
  const cab = world.addSurface({ id: 'cab', x: 400, y: 392, w: 160, h: 12, kind: 'shelf' });
  const laptop = new Item('laptop', cab.spec.x + 48, cab.spec.y - 42 / 2 - 1);
  world.addItem(laptop);
  const door = world.addDoor(new Door({ id: 'cabinet', x: 388, y: 250, w: 185, h: 158 }));
  world.addKitten(new Kitten(KITTENS.A, cab.spec.x + 20, cab.spec.y - 14, new Rng(1), world));
  return { world, laptop, door };
}

describe('doors', () => {
  it('a closed door seals its item - it cannot move or be reached', () => {
    const { world, laptop, door } = cabinetWorld();
    door.closed = true;
    const startX = laptop.body.position.x;
    const startY = laptop.body.position.y;

    world.releaseItems();
    for (let i = 0; i < PHYSICS_HZ * 20; i++) world.step();

    expect(world.isSealed(laptop)).toBe(true);
    expect(laptop.broken).toBe(false);
    expect(laptop.body.position.x).toBeCloseTo(startX, 1);
    expect(laptop.body.position.y).toBeCloseTo(startY, 1);
    expect(laptop.body.isStatic).toBe(true);
  });

  it('an open door leaves the item reachable (not sealed)', () => {
    const { world, laptop } = cabinetWorld();
    world.releaseItems();
    expect(world.isSealed(laptop)).toBe(false);
    expect(laptop.body.isStatic).toBe(false);
  });
});
