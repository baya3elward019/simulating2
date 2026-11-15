import {describe, expect, it} from 'vitest';
import {HALF_FACTOR, HASHES, collisionApprox, collisionExact, dayLabel, estimate, exactProbability, findMatches, findSignatureCollision, nForProbability, pairs, randomGroup, smallestGroupFor, sweep, truncatedHash} from './birthday';

// Small deterministic generator so the simulation tests are repeatable.
function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('birthday paradox', () => {
  it('matches the textbook probabilities', () => {
    expect(exactProbability(1)).toBe(0);
    expect(exactProbability(23)).toBeCloseTo(0.5073, 4);
    expect(exactProbability(50)).toBeCloseTo(0.9704, 4);
    expect(exactProbability(366)).toBe(1);
    expect(smallestGroupFor(0.5)).toBe(23);
    expect(pairs(23)).toBe(253);
  });

  it('finds every shared birthday and who shares it', () => {
    expect(findMatches([10, 4, 10, 200, 4, 10])).toEqual([
      {day: 10, people: [0, 2, 5]},
      {day: 4, people: [1, 4]},
    ]);
    expect(findMatches([1, 2, 3])).toEqual([]);
  });

  it('simulation agrees with the formula', () => {
    const rand = seeded(42);
    expect(randomGroup(30, rand).every(d => d >= 0 && d < 365)).toBe(true);
    expect(estimate(23, 20000, rand)).toBeCloseTo(exactProbability(23), 1);
  });

  it('labels days of the year', () => {
    expect(dayLabel(0)).toBe('1 Jan');
    expect(dayLabel(364)).toBe('31 Dec');
  });
});

describe('collision maths for the assignment', () => {
  it('reproduces the exact and approximate values (four decimals)', () => {
    expect(collisionExact(10).toFixed(4)).toBe('0.1169');
    expect(collisionExact(23).toFixed(4)).toBe('0.5073');
    expect(collisionExact(50).toFixed(4)).toBe('0.9704');
    expect(collisionApprox(10).toFixed(4)).toBe('0.1160');
    expect(collisionApprox(23).toFixed(4)).toBe('0.5000');
    expect(collisionApprox(50).toFixed(4)).toBe('0.9651');
    expect(HALF_FACTOR).toBeCloseTo(1.1774, 4);
    expect(nForProbability(0.5, 365)).toBeCloseTo(22.494, 3);
  });

  it('gives the session-ID and hash numbers', () => {
    expect(nForProbability(0.5, 65536)).toBeCloseTo(301.4, 1);
    expect(smallestGroupFor(0.5, 65536)).toBe(302);
    expect(HASHES.map(h => h.name)).toEqual(['MD5', 'SHA-1', 'SHA-256']);
    expect(HASHES[0].collision50).toBeCloseTo(1.1774 * 2 ** 64, -16);
    expect(HASHES[2].securityBits).toBe(128);
  });

  it('runs the n = 5…70 experiment and stays near the theory', () => {
    const rows = sweep({trials: 10000, rand: seeded(7)});
    expect(rows.map(r => r.n)).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);
    for (const r of rows) expect(Math.abs(r.diff)).toBeLessThan(Math.max(0.025, 2 * r.margin));
    expect(estimate(302, 2000, seeded(3), 65536)).toBeGreaterThan(0.44);
  });

  it('finds a signature collision on a truncated hash near the birthday bound', async () => {
    const r = await findSignatureCollision(16);
    expect(r).not.toBeNull();
    expect(await truncatedHash(r!.fairText, 16)).toBe(await truncatedHash(r!.fraudText, 16));
    expect(r!.fairText).toContain('1,000 dollars');
    expect(r!.fraudText).toContain('100,000 dollars');
    expect(r!.attempts).toBeLessThan(20 * r!.expected);
  });
});
