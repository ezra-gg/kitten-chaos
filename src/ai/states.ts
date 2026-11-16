/**
 * Kitten state-machine vocabulary and timing. States for M2 are Nap, Wander,
 * Jump, Stalk and Bat; Zoomies and Distracted arrive in M5 (section 4.1).
 */
export type KittenState =
  | 'nap'
  | 'wander'
  | 'jump'
  | 'stalk'
  | 'bat'
  | 'zoomies'
  | 'distracted';

/** All timings are in physics steps (60 = 1 second). */
export const TIMING = {
  napMin: 60,
  napMax: 120,
  wanderMin: 45,
  wanderMax: 100,
  /** Pre-bat wiggle, ~1 second. */
  wiggle: 60,
  /** Pause between successive bats. */
  batPause: 18,
  /** A kitten bats a target up to this many times before giving up. */
  maxBats: 3,
  /** Zoomies last ~3 seconds (section 4.1). */
  zoomiesSteps: 180,
  /** Zoomies sprint speed as a multiple of the kitten's walk speed. */
  zoomSpeedMul: 2.8,
  /** A zoomies body-slam's knock, relative to a deliberate bat. */
  zoomBumpFactor: 0.75,
} as const;
