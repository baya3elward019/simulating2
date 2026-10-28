// Birthday paradox: pure helpers shared by the page and the tests.
// Assumes 365 equally likely birthdays (no 29 February, no twins).

export const DAYS = 365;

/** Exact probability that at least two of n people share a birthday. */
export function exactProbability(n: number): number {
  if (n < 2) return 0;
  if (n > DAYS) return 1;
  let allDifferent = 1;
  for (let k = 0; k < n; k++) allDifferent *= (DAYS - k) / DAYS;
  return 1 - allDifferent;
}

/** Number of distinct pairs that can be compared in a group of n. */
export const pairs = (n: number) => (n * (n - 1)) / 2;

/** n random birthdays as day numbers 0–364. */
export function randomGroup(n: number, rand: () => number = Math.random): number[] {
  return Array.from({length: n}, () => Math.floor(rand() * DAYS));
}

export type Match = {day: number; people: number[]};

/** Every birthday shared by two or more people, with the people (0-based) who share it. */
export function findMatches(days: number[]): Match[] {
  const byDay = new Map<number, number[]>();
  days.forEach((day, person) => byDay.set(day, [...(byDay.get(day) ?? []), person]));
  return [...byDay.entries()]
    .filter(([, people]) => people.length > 1)
    .map(([day, people]) => ({day, people}))
    .sort((a, b) => a.people[0] - b.people[0]);
}

/** Fraction of `trials` random groups of size n that contain at least one shared birthday. */
export function estimate(n: number, trials: number, rand: () => number = Math.random): number {
  let hits = 0;
  for (let t = 0; t < trials; t++) {
    const seen = new Uint8Array(DAYS);
    for (let p = 0; p < n; p++) {
      const day = Math.floor(rand() * DAYS);
      if (seen[day]) { hits++; break; }
      seen[day] = 1;
    }
  }
  return trials ? hits / trials : 0;
}

/** Smallest group size whose match probability reaches `target`. */
export function smallestGroupFor(target: number): number {
  let n = 1;
  while (exactProbability(n) < target) n++;
  return n;
}

/** "14 Mar" style label for a day number (non-leap year). */
export function dayLabel(day: number, ar = false): string {
  return new Date(2025, 0, 1 + day).toLocaleDateString(ar ? 'ar-LY' : 'en-GB', {day: 'numeric', month: 'short'});
}
