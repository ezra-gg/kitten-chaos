import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/game/levelset';
import { auditLevel } from '../src/game/solver';

/**
 * The balance contract (M6 definition of done): every shipped level must have a
 * verified 3★ solution within its budget, and must NOT be winnable (3★) by doing
 * nothing. This guards against future tuning regressions.
 */
describe('level balance', () => {
  for (const level of LEVELS) {
    it(`${level.id} is fair (3★ solvable) and not trivial`, () => {
      const audit = auditLevel(level);
      expect(audit.solvable3, `${level.id}: no 3★ solution in ${level.moves} moves`).toBe(true);
      expect(audit.trivial, `${level.id}: wins 3★ with no prep`).toBe(false);
    });
  }
});
