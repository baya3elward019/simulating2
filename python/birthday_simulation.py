"""
Birthday paradox – assignment 2, part 3 (exercise A) and the session-ID application.

Runs a Monte Carlo experiment for n = 5, 10, ..., 70 people with 10,000 random
groups each (birthdays drawn uniformly from 1..365), compares the observed
proportion of groups with a repeated birthday against the exact formula
p(n) = 1 - prod_{k=0}^{n-1} (N-k)/N and the approximation 1 - e^{-n(n-1)/(2N)},
prints a table (four decimals), saves it as CSV and draws both curves on one chart.

Usage:
    python birthday_simulation.py                 # assignment settings
    python birthday_simulation.py --trials 100000 --seed 7 --out results

Only the standard library is needed for the table; matplotlib is used for the chart.
"""
from __future__ import annotations

import argparse
import csv
import math
import random
from pathlib import Path

DAYS = 365


def exact_probability(n: int, N: int = DAYS) -> float:
    """Exact probability that at least two of n values (from N equally likely) coincide."""
    if n < 2:
        return 0.0
    if n > N:
        return 1.0
    all_different = 1.0
    for k in range(n):
        all_different *= (N - k) / N
    return 1.0 - all_different


def approx_probability(n: int, N: int = DAYS) -> float:
    """Exponential approximation p(n) ≈ 1 - e^{-n(n-1)/(2N)}."""
    return 1.0 - math.exp(-n * (n - 1) / (2 * N))


def has_repeat(n: int, N: int, rng: random.Random) -> bool:
    """One random experiment: draw n values from 1..N and report whether any value repeats."""
    seen = set()
    for _ in range(n):
        day = rng.randint(1, N)
        if day in seen:
            return True
        seen.add(day)
    return False


def simulate(n: int, trials: int, N: int, rng: random.Random) -> float:
    """Proportion of `trials` experiments that contain a repeated value."""
    return sum(has_repeat(n, N, rng) for _ in range(trials)) / trials


def run_experiment(trials: int = 10_000, seed: int = 2026, N: int = DAYS):
    rng = random.Random(seed)
    rows = []
    for n in range(5, 71, 5):
        sim = simulate(n, trials, N, rng)
        exact = exact_probability(n, N)
        margin = 1.96 * math.sqrt(exact * (1 - exact) / trials)
        rows.append({"n": n, "simulated": sim, "theoretical": exact, "approx": approx_probability(n, N),
                     "difference": sim - exact, "margin95": margin})
    return rows


def print_table(rows, trials: int) -> None:
    print(f"\nBirthday paradox – {trials:,} trials per n (N = {DAYS})")
    print(f"{'n':>4} | {'simulated':>9} | {'theory':>9} | {'approx':>9} | {'diff':>8} | {'±95%':>7}")
    print("-" * 62)
    for r in rows:
        print(f"{r['n']:>4} | {r['simulated']:9.4f} | {r['theoretical']:9.4f} | {r['approx']:9.4f} | "
              f"{r['difference']:+8.4f} | {r['margin95']:7.4f}")
    mean_abs = sum(abs(r["difference"]) for r in rows) / len(rows)
    inside = sum(abs(r["difference"]) <= r["margin95"] for r in rows)
    print(f"\nMean |simulated - theory| = {mean_abs:.4f}; {inside}/{len(rows)} points inside the 95% margin.")


def trials_study(n: int = 23, seed: int = 99, repeats: int = 10) -> None:
    """How the error shrinks when the number of trials grows (≈ 1/√T)."""
    rng = random.Random(seed)
    exact = exact_probability(n)
    print(f"\nEffect of the number of trials (n = {n}, exact = {exact:.4f}, {repeats} repetitions each)")
    print(f"{'trials':>8} | {'mean |error|':>12} | {'expected SE':>11}")
    for T in (100, 1_000, 10_000):
        errors = [abs(simulate(n, T, DAYS, rng) - exact) for _ in range(repeats)]
        print(f"{T:>8,} | {sum(errors) / repeats:12.4f} | {math.sqrt(exact * (1 - exact) / T):11.4f}")


def session_ids(bits: int = 16, trials: int = 2_000, seed: int = 5) -> None:
    """Session-ID application: N = 2^bits possible IDs."""
    N = 2 ** bits
    n50 = math.sqrt(2 * N * math.log(2))
    n_up = math.ceil(n50)
    print(f"\nSession IDs: N = 2^{bits} = {N:,};  sqrt(N) = {math.sqrt(N):.4f}")
    print(f"n ≈ 1.1774 × sqrt(N) = {n50:.4f} → {n_up} active sessions")
    print(f"exact P(collision) with {n_up} sessions = {exact_probability(n_up, N):.4f}")
    print(f"simulated with {trials:,} servers = {simulate(n_up, trials, N, random.Random(seed)):.4f}")


def hashes() -> None:
    print("\nHash functions: inputs needed for a 50% collision ≈ 1.1774 × 2^(b/2)")
    for name, b in (("MD5", 128), ("SHA-1", 160), ("SHA-256", 256)):
        k = math.sqrt(2 * math.log(2)) * 2 ** (b / 2)
        print(f"{name:>8} ({b} bits): {k:.4e} ≈ 2^{math.log2(k):.2f};  second preimage ≈ 2^{b}")


def save_outputs(rows, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    with open(out / "birthday_results.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        for r in rows:
            writer.writerow({k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()})
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib is not installed: chart skipped (pip install matplotlib).")
        return
    ns = [r["n"] for r in rows]
    smooth = list(range(1, 71))
    plt.figure(figsize=(9, 5))
    plt.plot(smooth, [exact_probability(n) for n in smooth], label="Theoretical (exact)", color="#3158a0", linewidth=2.2)
    plt.plot(smooth, [approx_probability(n) for n in smooth], "--", label="Approximation 1 - e^(-n(n-1)/2N)", color="#2a9d8f")
    plt.plot(ns, [r["simulated"] for r in rows], "o", label="Simulated (10,000 trials)", color="#e76f51")
    plt.axhline(0.5, color="grey", linestyle=":", linewidth=1)
    plt.axvline(23, color="grey", linestyle=":", linewidth=1)
    plt.xlabel("Number of people n")
    plt.ylabel("P(at least one shared birthday)")
    plt.title("Birthday paradox: simulation vs theory")
    plt.grid(alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.savefig(out / "birthday_chart.png", dpi=150)
    print(f"\nSaved {out / 'birthday_results.csv'} and {out / 'birthday_chart.png'}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--trials", type=int, default=10_000)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--out", type=Path, default=Path(__file__).with_name("output"))
    args = parser.parse_args()
    rows = run_experiment(args.trials, args.seed)
    print_table(rows, args.trials)
    trials_study()
    session_ids()
    hashes()
    save_outputs(rows, args.out)


if __name__ == "__main__":
    main()
