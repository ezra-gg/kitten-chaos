import { describe, expect, it } from 'vitest';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, PHYSICS_HZ } from '../src/config/constants';
import { KITTENS } from '../src/config/kittens';
import { Attractor } from '../src/entities/attractor';
import { Item } from '../src/entities/item';
import { Kitten } from '../src/entities/kitten';
import { PhysicsWorld } from '../src/engine/physics';
import { Rng } from '../src/engine/rng';

function baseWorld() {
  const world = new PhysicsWorld();
  world.addSurface({ id: 'floor', x: 0, y: LOGICAL_HEIGHT - 40, w: LOGICAL_WIDTH, h: 40, kind: 'floor' });
  const shelf = world.addSurface({ id: 'shelf', x: 300, y: 320, w: 300, h: 14, kind: 'shelf' });
  world.addItem(new Item('vase', shelf.spec.x + 260, shelf.spec.y - 54 / 2 - 1));
  return { world, shelf };
}

describe('attractors', () => {
  it('a box lures a kitten into the distracted state', () => {
    const { world, shelf } = baseWorld();
    const kitten = world.addKitten(new Kitten(KITTENS.A, shelf.spec.x + 20, shelf.spec.y - 14, new Rng(1), world));
    world.addAttractor(new Attractor('box', 480, LOGICAL_HEIGHT - 40));
    world.releaseItems();

    let becameDistracted = false;
    for (let i = 0; i < PHYSICS_HZ * 8; i++) {
      world.step();
      if (kitten.state === 'distracted') becameDistracted = true;
    }
    expect(becameDistracted).toBe(true);
  });

  it('a treat pulls both kittens to the bowl', () => {
    const { world, shelf } = baseWorld();
    const a = world.addKitten(new Kitten(KITTENS.A, shelf.spec.x + 20, shelf.spec.y - 14, new Rng(2), world));
    const b = world.addKitten(new Kitten(KITTENS.B, shelf.spec.x + 260, shelf.spec.y - 14, new Rng(3), world));
    world.releaseItems();

    const bowl = world.addAttractor(new Attractor('treat', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 40));
    bowl.available = true;
    bowl.ttl = 4 * PHYSICS_HZ;
    a.lureToTreat(bowl);
    b.lureToTreat(bowl);

    expect(a.state).toBe('distracted');
    expect(b.state).toBe('distracted');

    // After traveling, both should be near the bowl.
    for (let i = 0; i < PHYSICS_HZ; i++) world.step();
    expect(Math.abs(a.x - bowl.x)).toBeLessThan(60);
    expect(Math.abs(b.x - bowl.x)).toBeLessThan(60);
  });

  it('a box is single-use (spent after a kitten sits in it)', () => {
    const { world, shelf } = baseWorld();
    world.addKitten(new Kitten(KITTENS.A, shelf.spec.x + 20, shelf.spec.y - 14, new Rng(4), world));
    const box = world.addAttractor(new Attractor('box', 480, LOGICAL_HEIGHT - 40));
    world.releaseItems();

    // The Batter sits for the full 10s; run long enough for a full sit cycle.
    for (let i = 0; i < PHYSICS_HZ * 16; i++) world.step();
    expect(box.spent).toBe(true);
  });
});
