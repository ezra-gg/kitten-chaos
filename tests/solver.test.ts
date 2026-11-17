import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/game/levelset';
import { auditLevel } from '../src/game/solver';

/**
 * The balance contract (M6 definition of done): every shipped level must have a
 * verified 3★ solution within its budget, must NOT be winnable (3★) by doing
 * nothing, and must give fewer moves than it has items so that "lock down
 * everything" is never an affordable play. This guards against tuning regressions.
 */
describe('level balance', () => {
  for (const level of LEVELS) {
    it(`${level.id} is fair (3★ solvable) and not trivial`, () => {
      const audit = auditLevel(level);
      expect(audit.solvable3, `${level.id}: no 3★ solution in ${level.moves} moves`).toBe(true);
      expect(audit.trivial, `${level.id}: wins 3★ with no prep`).toBe(false);
      expect(
        level.moves,
        `${level.id}: ${level.moves} moves for ${level.items.length} items lets you lock down everything`,
      ).toBeLessThan(level.items.length);
    });
  }
});
