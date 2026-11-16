/**
 * Seeded pseudo-random number generator (mulberry32). Deterministic: the same
 * seed always yields the same sequence. Every kitten decision must draw from an
 * instance of this - never Math.random() - so levels are learnable and a given
 * seed + prep reproduces exactly (project plan section 9).
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Coerce to a 32-bit unsigned integer.
    this.state = seed >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Uniformly pick one element of a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length)];
  }

  /** A snapshot of internal state, for save/replay of an in-progress run. */
  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }
}
