import {describe, expect, it} from 'vitest';
import {dayLabel, estimate, exactProbability, findMatches, pairs, randomGroup, smallestGroupFor} from './birthday';

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
