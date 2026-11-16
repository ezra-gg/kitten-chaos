/**
 * Central tuning constants. The project plan calls out that most polish time
 * goes here, so keep every magic number in this file.
 */

// --- Logical canvas resolution (16:9). Everything is authored in these units.
export const LOGICAL_WIDTH = 960;
export const LOGICAL_HEIGHT = 540;

// --- Physics stepping. Fixed 60 Hz, decoupled from render, for determinism.
export const PHYSICS_HZ = 60;
export const PHYSICS_STEP_MS = 1000 / PHYSICS_HZ;
// Cap substeps per frame so a slow/background tab can't trigger a spiral of death.
export const MAX_SUBSTEPS = 5;
// If the browser hands us a huge gap (tab was hidden), clamp it.
export const MAX_FRAME_MS = 250;

// --- World.
export const GRAVITY_Y = 1;

// --- Phases.
export const CHAOS_SECONDS = 30;

// --- Prep actions.
/** Move cost of each action (section 3.1). */
export const ACTION_COST = {
  relocate: 1,
  putty: 1,
  closeDoor: 1,
  box: 2,
  toy: 1,
  treat: 2,
} as const;
/** Score bonus per unspent move (section 3.3). */
export const UNSPENT_MOVE_BONUS = 5;
/** Fraction of its value a sturdy item keeps if it ends up knocked over. */
export const KNOCKED_OVER_RETAIN = 0.5;
/** Star thresholds as a fraction of the level's total value saved (section 3.3). */
export const STAR_THRESHOLDS = { one: 0.5, two: 0.75, three: 1.0 } as const;
/** Number of bats a museum-putty blob resists before coming loose (section 3.1). */
export const PUTTY_RESIST = 2;

// --- Break detection.
// A fragile item shatters if its approach speed at impact exceeds this.
// Matter's body.speed is in px per 60 Hz step; a short drop is ~4-6, a fall to
// the floor is ~10+. Tune here.
export const BREAK_SPEED_THRESHOLD = 6.5;
// Sturdy items never break but count as "knocked over" if they rotate past this
// many radians from upright (used from M4 onward for the smaller penalty).
export const KNOCKED_OVER_ANGLE = 0.7;
