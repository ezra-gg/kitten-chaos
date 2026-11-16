import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('returns floats in [0, 1)', () => {
    const r = new Rng(999);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(min, max) stays in range', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThan(9);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('pick stays within the array and is deterministic', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const r1 = new Rng(42);
    const r2 = new Rng(42);
    const picks1 = Array.from({ length: 10 }, () => r1.pick(arr));
    const picks2 = Array.from({ length: 10 }, () => r2.pick(arr));
    expect(picks1).toEqual(picks2);
    for (const p of picks1) expect(arr).toContain(p);
  });

  it('can save and restore its state mid-stream', () => {
    const r = new Rng(555);
    r.next();
    r.next();
    const snapshot = r.getState();
    const after = [r.next(), r.next(), r.next()];

    const restored = new Rng(0);
    restored.setState(snapshot);
    const afterRestored = [restored.next(), restored.next(), restored.next()];
    expect(afterRestored).toEqual(after);
  });
});
