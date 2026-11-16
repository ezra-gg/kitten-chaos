import { describe, expect, it } from 'vitest';
import { CHAOS_SECONDS, PHYSICS_HZ } from '../src/config/constants';
import { buildLevel } from '../src/game/levels';
import { LEVELS } from '../src/game/levelset';

/**
 * Safety net: a fully locked-down room must be safe. If the player putties every
 * item, nothing should break during chaos - there is always a thorough,
 * guaranteed-safe play. This also guards the break model (crashes, slams) from
 * ever shattering items that are all pinned in place.
 */
describe('lockdown safety net', () => {
  for (const level of LEVELS) {
    it(`${level.id}: puttying every item keeps the room intact`, () => {
      const { world } = buildLevel(level);
      for (const item of world.items) item.putty();
      world.releaseItems();
      for (let i = 0; i < CHAOS_SECONDS * PHYSICS_HZ; i++) world.step();
      const broken = world.items.filter((i) => i.broken).length;
      expect(broken, `${level.id}: ${broken} item(s) broke despite full putty`).toBe(0);
    });
  }
});
