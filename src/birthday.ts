// Birthday paradox: pure helpers shared by the page, the Excel export and the tests.
// Assumes N equally likely values (365 birthdays by default: no 29 February, no twins).

export const DAYS = 365;
/** √(2 ln 2) ≈ 1.1774: the constant in n ≈ 1.1774 √N for a 50% collision chance. */
export const HALF_FACTOR = Math.sqrt(2 * Math.LN2);

/** Exact probability that at least two of n items drawn from N equally likely values coincide. */
export function collisionExact(n: number, N: number = DAYS): number {
  if (n < 2) return 0;
  if (n > N) return 1;
  // Sum of logs keeps the product (N/N)·((N−1)/N)·…·((N−n+1)/N) accurate for large N.
  let logAllDifferent = 0;
  for (let k = 1; k < n; k++) logAllDifferent += Math.log1p(-k / N);
  return 1 - Math.exp(logAllDifferent);
}

/** Exact probability that at least two of n people share a birthday (N = 365). */
export const exactProbability = (n: number) => collisionExact(n, DAYS);

/** Exponential approximation p(n) ≈ 1 − e^(−n(n−1)/(2N)). */
export function collisionApprox(n: number, N: number = DAYS): number {
  if (n < 2) return 0;
  return 1 - Math.exp(-(n * (n - 1)) / (2 * N));
}

/** Continuous n that gives probability p by the approximation: n ≈ √(2N·ln(1/(1−p))). */
export function nForProbability(p: number, N: number = DAYS): number {
  if (p <= 0) return 0;
  if (p >= 1) return Infinity;
  return Math.sqrt(2 * N * Math.log(1 / (1 - p)));
}

/** Number of distinct pairs that can be compared in a group of n. */
export const pairs = (n: number) => (n * (n - 1)) / 2;

/** n random birthdays as day numbers 0–364. */
export function randomGroup(n: number, rand: () => number = Math.random, N: number = DAYS): number[] {
  return Array.from({length: n}, () => Math.floor(rand() * N));
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

/** Fraction of `trials` random groups of size n (values from N) that contain at least one collision. */
export function estimate(n: number, trials: number, rand: () => number = Math.random, N: number = DAYS): number {
  if (trials <= 0) return 0;
  let hits = 0;
  if (N <= 1 << 20) {
    const seen = new Uint32Array(N);
    for (let t = 1; t <= trials; t++) {
      // Mark with the trial number instead of clearing the array every trial.
      for (let p = 0; p < n; p++) {
        const v = Math.floor(rand() * N);
        if (seen[v] === t) { hits++; break; }
        seen[v] = t;
      }
    }
  } else {
    for (let t = 0; t < trials; t++) {
      const seen = new Set<number>();
      for (let p = 0; p < n; p++) {
        const v = Math.floor(rand() * N);
        if (seen.has(v)) { hits++; break; }
        seen.add(v);
      }
    }
  }
  return hits / trials;
}

/** Smallest group size whose exact match probability reaches `target`. */
export function smallestGroupFor(target: number, N: number = DAYS): number {
  let n = 1;
  while (collisionExact(n, N) < target) n++;
  return n;
}

export type SweepRow = {n: number; trials: number; simulated: number; exact: number; approx: number; diff: number; margin: number};

/**
 * Simulation experiment (assignment part 3): for n = from, from+step, …, to run `trials` random groups,
 * and compare the observed collision rate with the exact and approximate probabilities.
 * `margin` is the 95% sampling margin 1.96·√(p(1−p)/trials) around the exact probability.
 */
export function sweep({from = 5, to = 70, step = 5, trials = 10000, N = DAYS, rand = Math.random}: {from?: number; to?: number; step?: number; trials?: number; N?: number; rand?: () => number} = {}): SweepRow[] {
  const rows: SweepRow[] = [];
  if (step <= 0 || from < 1 || to < from) return rows;
  for (let n = from; n <= to; n += step) {
    const simulated = estimate(n, trials, rand, N), exact = collisionExact(n, N);
    rows.push({n, trials, simulated, exact, approx: collisionApprox(n, N), diff: simulated - exact, margin: 1.96 * Math.sqrt(exact * (1 - exact) / trials)});
  }
  return rows;
}

export type HashRow = {name: string; bits: number; log2Collision: number; collision50: number; preimage: number; securityBits: number};

/**
 * Birthday bound for a b-bit hash: about 1.1774·2^(b/2) hashes give a 50% collision chance,
 * whereas finding an input for one fixed hash (second preimage) needs about 2^b attempts.
 */
export function hashCollision(bits: number, name = `${bits}-bit`): HashRow {
  return {name, bits, log2Collision: bits / 2 + Math.log2(HALF_FACTOR), collision50: HALF_FACTOR * 2 ** (bits / 2), preimage: 2 ** bits, securityBits: bits / 2};
}

export const HASHES = [hashCollision(128, 'MD5'), hashCollision(160, 'SHA-1'), hashCollision(256, 'SHA-256')];

/** "14 Mar" style label for a day number (non-leap year). */
export function dayLabel(day: number, ar = false): string {
  return new Date(2025, 0, 1 + day).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {day: 'numeric', month: 'short'});
}

/** Scientific notation with `digits` decimals, e.g. 2.1719 × 10^19. */
export function sci(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return '∞';
  if (Math.abs(x) < 1e6) return x.toLocaleString('en-US', {maximumFractionDigits: digits});
  const [m, e] = x.toExponential(digits).split('e');
  return `${m} × 10^${Number(e)}`;
}

// ---------------------------------------------------------------------------
// Hash-collision attack on a digital signature (Yuval's birthday attack) on a truncated SHA-256.

/** Contract text whose invisible whitespace encodes `variant` (one bit per word gap). */
export function contractVariant(fair: boolean, variant: number): string {
  const words = (fair
    ? 'I the undersigned agree to pay the supplier the amount of 1,000 dollars only for the delivery of the goods described in the attached order before the end of this month'
    : 'I the undersigned agree to pay the supplier the amount of 100,000 dollars only for the delivery of the goods described in the attached order before the end of this month').split(' ');
  return words.map((w, i) => (i && (variant >>> (i - 1)) & 1 ? '  ' : i ? ' ' : '') + w).join('');
}

/** First `bits` bits of SHA-256(text) as an integer (bits ≤ 32). */
export async function truncatedHash(text: string, bits: number): Promise<number> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const word = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  return bits >= 32 ? word : word >>> (32 - bits);
}

export type AttackResult = {bits: number; hash: number; fairVariant: number; fraudVariant: number; fairText: string; fraudText: string; attempts: number; expected: number};

/**
 * Generates fair and fraudulent contract variants alternately until one fair and one fraudulent
 * variant share the same truncated hash. Expected work ≈ 2 × √(N·ln 2) hashes for N = 2^bits.
 */
export async function findSignatureCollision(bits: number, maxAttempts = 2_000_000): Promise<AttackResult | null> {
  const fair = new Map<number, number>(), fraud = new Map<number, number>();
  const expected = 2 * Math.sqrt(2 ** bits * Math.LN2);
  for (let i = 0; 2 * i < maxAttempts; i++) {
    const hf = await truncatedHash(contractVariant(true, i), bits);
    if (fraud.has(hf)) return done(hf, i, fraud.get(hf)!, 2 * i + 1);
    if (!fair.has(hf)) fair.set(hf, i);
    const hb = await truncatedHash(contractVariant(false, i), bits);
    if (fair.has(hb)) return done(hb, fair.get(hb)!, i, 2 * i + 2);
    if (!fraud.has(hb)) fraud.set(hb, i);
  }
  return null;
  function done(hash: number, fairVariant: number, fraudVariant: number, attempts: number): AttackResult {
    return {bits, hash, fairVariant, fraudVariant, fairText: contractVariant(true, fairVariant), fraudText: contractVariant(false, fraudVariant), attempts, expected};
  }
}
