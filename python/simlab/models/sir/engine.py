"""SIR malware-propagation model (discrete daily steps).

    New infections_t = β · S_{t-1} · I_{t-1} / N
    Recoveries_t     = γ · I_{t-1}
    S_t = S_{t-1} − New infections_t
    I_t = I_{t-1} + New infections_t − Recoveries_t
    R_t = R_{t-1} + Recoveries_t

Every day uses the previous day's values. Nothing is rounded during the calculation; the UI and
Excel round only when displaying.
"""
from __future__ import annotations

from typing import Any

from ...validation import Checker, ValidationError

DEFAULTS: dict[str, Any] = {"N": 1000, "S0": 995, "I0": 5, "R0": 0, "beta": 0.4, "gamma": 0.1, "days": 5}
MAX_DAYS = 365
LABELS = {
    "N": ("Total devices (N)", "إجمالي الأجهزة (N)"),
    "S0": ("Susceptible devices (S0)", "الأجهزة المعرّضة (S0)"),
    "I0": ("Infected devices (I0)", "الأجهزة المصابة (I0)"),
    "R0": ("Recovered devices (R0)", "الأجهزة المتعافية (R0)"),
    "beta": ("Infection rate (β)", "معدل الإصابة (β)"),
    "gamma": ("Recovery rate (γ)", "معدل التعافي (γ)"),
    "days": ("Simulation days", "عدد أيام المحاكاة"),
}


def conservation_tolerance(n: float) -> float:
    return 1e-9 * max(1.0, abs(n))


def validate(params: dict[str, Any] | None) -> dict[str, Any]:
    c = Checker(params, DEFAULTS)
    n = c.number("N", LABELS["N"], positive=True)
    s0 = c.number("S0", LABELS["S0"], minimum=0)
    i0 = c.number("I0", LABELS["I0"], minimum=0)
    r0 = c.number("R0", LABELS["R0"], minimum=0)
    # β ≤ 1 and γ ≤ 1 guarantee S, I and R can never become negative in a daily step:
    # β·S·I/N ≤ S because I ≤ N, and γ·I ≤ I.
    c.number("beta", LABELS["beta"], minimum=0, maximum=1)
    c.number("gamma", LABELS["gamma"], minimum=0, maximum=1)
    c.number("days", LABELS["days"], minimum=1, maximum=MAX_DAYS, integer=True)
    if None not in (n, s0, i0, r0) and abs(s0 + i0 + r0 - n) > conservation_tolerance(n):
        c.fail("S0", f"S0 + I0 + R0 must equal N ({s0:g} + {i0:g} + {r0:g} = {s0 + i0 + r0:g}, N = {n:g}).",
               f"يجب أن يكون S0 + I0 + R0 = N (المجموع {s0 + i0 + r0:g} و N = {n:g}).")
    return c.done()


def step(state: dict[str, float], beta: float, gamma: float, n: float) -> dict[str, float]:
    """One day of the model, from yesterday's state only."""
    new = beta * state["S"] * state["I"] / n
    rec = gamma * state["I"]
    return {"S": state["S"] - new, "I": state["I"] + new - rec, "R": state["R"] + rec, "new_infections": new, "recoveries": rec}


def simulate(params: dict[str, Any] | None = None) -> dict[str, Any]:
    p = validate(params)
    n, beta, gamma = p["N"], p["beta"], p["gamma"]
    rows: list[dict[str, Any]] = [{"day": 0, "S": p["S0"], "I": p["I0"], "R": p["R0"], "new_infections": None, "recoveries": None,
                                   "total": p["S0"] + p["I0"] + p["R0"]}]
    for day in range(1, p["days"] + 1):
        nxt = step(rows[-1], beta, gamma, n)
        rows.append({"day": day, **nxt, "total": nxt["S"] + nxt["I"] + nxt["R"]})
    return {"model": "sir", "inputs": p, "rows": rows, "summary": summarize(p, rows), "chart": chart_data(rows)}


def summarize(p: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    final = rows[-1]
    peak = max(rows, key=lambda r: r["I"])
    return {
        "final": {"S": final["S"], "I": final["I"], "R": final["R"]},
        "peak_infected": peak["I"], "peak_day": peak["day"],
        "cumulative_new_infections": sum(r["new_infections"] or 0 for r in rows),
        "cumulative_recoveries": sum(r["recoveries"] or 0 for r in rows),
        "basic_reproduction_number": (p["beta"] / p["gamma"]) if p["gamma"] > 0 else None,
        "max_conservation_error": max(abs(r["total"] - p["N"]) for r in rows),
        "conserved": all(abs(r["total"] - p["N"]) <= conservation_tolerance(p["N"]) for r in rows),
    }


def chart_data(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Points for the S/I/R line chart and the daily-flow chart."""
    return [{"day": r["day"], "S": r["S"], "I": r["I"], "R": r["R"],
             "new_infections": r["new_infections"] or 0.0, "recoveries": r["recoveries"] or 0.0} for r in rows]


def excel_rows(result: dict[str, Any]) -> list[list[Any]]:
    """Header + one row per day: the plain table used by the CLI (CSV) and the Excel Python check."""
    out: list[list[Any]] = [["Day", "S", "I", "R", "New infections", "Recoveries", "S+I+R"]]
    for r in result["rows"]:
        out.append([r["day"], r["S"], r["I"], r["R"], r["new_infections"], r["recoveries"], r["total"]])
    return out


__all__ = ["DEFAULTS", "LABELS", "MAX_DAYS", "ValidationError", "validate", "step", "simulate", "chart_data", "excel_rows"]
