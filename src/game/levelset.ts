import { generateLevel } from './generator';
import { HAND_LEVELS, LevelDef } from './levels';

/** How many procedural levels to append after the hand-authored intro. */
const GENERATED_COUNT = 6;
/** Base seed for the generated set; each level uses baseSeed + i*step. */
const BASE_SEED = 7000;
const SEED_STEP = 137;

/**
 * Deterministically generate the procedural levels once, with an increasing
 * difficulty tier. Because generation is seeded, the same set appears every run.
 */
function generatedLevels(): LevelDef[] {
  const out: LevelDef[] = [];
  for (let i = 0; i < GENERATED_COUNT; i++) {
    out.push(generateLevel(BASE_SEED + i * SEED_STEP, i + 1));
  }
  return out;
}

/** The full campaign: hand-authored intro levels, then procedural ones. */
export const LEVELS: LevelDef[] = [...HAND_LEVELS, ...generatedLevels()];
