"""IDS detection & Bayesian probability model.

Expected (theoretical) results:
    Malicious = N·m          Benign = N·(1 − m)
    TP = Malicious·TPR       FN = Malicious·(1 − TPR)
    FP = Benign·FPR          TN = Benign·(1 − FPR)
    Alerts = TP + FP
    P(Malicious | Alarm) = TP / (TP + FP)            (undefined → None when there are no alarms)
                         = TPR·m / (TPR·m + FPR·(1 − m))   — Bayes' theorem

Monte Carlo mode generates N virtual packets with a seeded RNG, labels each one malicious
with probability m, then raises an alarm with probability TPR (malicious) or FPR (benign).
Expected and simulated results are always reported separately.
"""
from __future__ import annotations

import math
import random
from typing import Any

from ...validation import Checker, ValidationError

DEFAULTS: dict[str, Any] = {
    "packets": 10000, "malicious_pct": 5.0, "tpr_pct": 99.0, "fpr_pct": 5.0,
    "monte_carlo": False, "seed": "2026",
    "scenarios": [{"name": "Scenario B – 1% malicious", "malicious_pct": 1.0}],
}
MAX_PACKETS = 100_000_000
MAX_MC_PACKETS = 1_000_000
MAX_SCENARIOS = 6
SAMPLE_SIZE = 25
LABELS = {
    "packets": ("Total packets", "إجمالي الحزم"),
    "malicious_pct": ("Malicious traffic rate (%)", "نسبة الحزم الخبيثة (%)"),
    "tpr_pct": ("Detection rate – TPR (%)", "معدل الكشف TPR (%)"),
    "fpr_pct": ("False positive rate – FPR (%)", "معدل الإنذار الكاذب FPR (%)"),
    "seed": ("Random seed", "البذرة العشوائية"),
}
PCT_KEYS = ("malicious_pct", "tpr_pct", "fpr_pct")


def _validate_core(raw: dict[str, Any] | None, defaults: dict[str, Any], prefix: str = "") -> tuple[dict[str, Any], list[dict[str, str]]]:
    c = Checker(raw, defaults)
    c.number("packets", LABELS["packets"], minimum=1, maximum=MAX_PACKETS, integer=True)
    for key in PCT_KEYS:
        c.number(key, LABELS[key], minimum=0, maximum=100)
    for e in c.errors:
        e["field"] = prefix + e["field"]
    return c.clean, c.errors


def validate(params: dict[str, Any] | None) -> dict[str, Any]:
    raw = params or {}
    core, errors = _validate_core(raw, DEFAULTS)
    c = Checker(raw, DEFAULTS)
    mc = c.flag("monte_carlo")
    c.text("seed", LABELS["seed"])
    errors += c.errors
    if mc and not errors and core["packets"] > MAX_MC_PACKETS:
        errors.append({"field": "packets", "en": f"Monte Carlo mode supports up to {MAX_MC_PACKETS:,} packets.",
                       "ar": f"وضع مونت كارلو يدعم حتى {MAX_MC_PACKETS:,} حزمة."})
    scenarios = raw.get("scenarios", DEFAULTS["scenarios"]) or []
    if not isinstance(scenarios, list):
        scenarios = []
    if len(scenarios) > MAX_SCENARIOS:
        errors.append({"field": "scenarios", "en": f"Compare at most {MAX_SCENARIOS} extra scenarios.", "ar": f"الحد الأقصى {MAX_SCENARIOS} سيناريوهات إضافية."})
        scenarios = scenarios[:MAX_SCENARIOS]
    clean_scenarios = []
    for i, s in enumerate(scenarios):
        s = s if isinstance(s, dict) else {}
        base = {k: core.get(k, DEFAULTS[k]) for k in ("packets", *PCT_KEYS)}   # missing fields inherit the current inputs
        values, errs = _validate_core(s, base, prefix=f"scenarios.{i}.")
        errors += errs
        name = str(s.get("name") or f"Scenario {chr(66 + i)}")[:60]
        clean_scenarios.append({"name": name, **values})
    if errors:
        raise ValidationError(errors)
    return {**core, "monte_carlo": mc, "seed": c.clean["seed"], "scenarios": clean_scenarios}


def _ratio(num: float, den: float) -> float | None:
    return None if den == 0 else num / den


def expected(p: dict[str, Any]) -> dict[str, Any]:
    """Theoretical counts and probabilities. Rates are given in percent."""
    n = p["packets"]
    m, tpr, fpr = p["malicious_pct"] / 100, p["tpr_pct"] / 100, p["fpr_pct"] / 100
    mal, ben = n * m, n * (1 - m)
    tp, fn, fp, tn = mal * tpr, mal * (1 - tpr), ben * fpr, ben * (1 - fpr)
    alerts = tp + fp
    p_alarm = tpr * m + fpr * (1 - m)
    ppv = _ratio(tp, alerts)
    precision_recall = (ppv or 0) + tpr
    return {
        "packets": n, "malicious": mal, "benign": ben, "tp": tp, "fn": fn, "fp": fp, "tn": tn,
        "alerts": alerts, "no_alerts": fn + tn,
        "p_malicious_given_alarm": ppv,
        "p_benign_given_alarm": _ratio(fp, alerts),
        "p_benign_given_no_alarm": _ratio(tn, tn + fn),
        "accuracy": (tp + tn) / n,
        "f1": None if ppv is None or precision_recall == 0 else 2 * ppv * tpr / precision_recall,
        "bayes": {
            "p_m": m, "p_b": 1 - m, "p_a_given_m": tpr, "p_a_given_b": fpr,
            "p_a_and_m": tpr * m, "p_a_and_b": fpr * (1 - m), "p_a": p_alarm,
            "posterior": None if p_alarm == 0 else tpr * m / p_alarm,
        },
    }


def monte_carlo(p: dict[str, Any]) -> dict[str, Any]:
    """Classify N virtual packets one by one with a reproducible RNG."""
    n = p["packets"]
    m, tpr, fpr = p["malicious_pct"] / 100, p["tpr_pct"] / 100, p["fpr_pct"] / 100
    rng = random.Random(p["seed"])
    draw = rng.random
    tp = fn = fp = tn = 0
    sample: list[dict[str, Any]] = []
    for i in range(n):
        u_class, u_alarm = draw(), draw()
        malicious = u_class < m
        alarm = u_alarm < (tpr if malicious else fpr)
        if malicious:
            if alarm: tp += 1
            else: fn += 1
        else:
            if alarm: fp += 1
            else: tn += 1
        if i < SAMPLE_SIZE:
            outcome = ("TP" if alarm else "FN") if malicious else ("FP" if alarm else "TN")
            sample.append({"packet": i + 1, "u_class": u_class, "malicious": malicious, "u_alarm": u_alarm, "alarm": alarm, "outcome": outcome})
    alerts = tp + fp
    ppv = _ratio(tp, alerts)
    margin = None if ppv is None else 1.96 * math.sqrt(ppv * (1 - ppv) / alerts)
    return {"seed": p["seed"], "packets": n, "malicious": tp + fn, "benign": fp + tn, "tp": tp, "fn": fn, "fp": fp, "tn": tn,
            "alerts": alerts, "no_alerts": fn + tn, "p_malicious_given_alarm": ppv, "ppv_margin95": margin,
            "accuracy": (tp + tn) / n, "sample": sample}


def compare(p: dict[str, Any]) -> list[dict[str, Any]]:
    """Current inputs first, then every extra scenario — expected results for each."""
    current = {"name": "Current inputs", **{k: p[k] for k in ("packets", *PCT_KEYS)}}
    return [{"name": s["name"], "inputs": {k: s[k] for k in ("packets", *PCT_KEYS)}, "expected": expected(s)}
            for s in (current, *p["scenarios"])]


def chart_data(result: dict[str, Any]) -> dict[str, Any]:
    e = result["expected"]
    alerts = [{"name": "True alerts (TP)", "key": "tp", "expected": e["tp"]}, {"name": "False alerts (FP)", "key": "fp", "expected": e["fp"]}]
    if result.get("simulated"):
        for a in alerts:
            a["simulated"] = result["simulated"][a["key"]]
    scenarios = [{"name": s["name"], "tp": s["expected"]["tp"], "fp": s["expected"]["fp"],
                  "ppv": s["expected"]["p_malicious_given_alarm"]} for s in result["comparison"]]
    return {"alerts": alerts, "scenarios": scenarios}


def simulate(params: dict[str, Any] | None = None) -> dict[str, Any]:
    p = validate(params)
    result: dict[str, Any] = {"model": "ids", "inputs": p, "expected": expected(p),
                              "simulated": monte_carlo(p) if p["monte_carlo"] else None, "comparison": compare(p)}
    result["chart"] = chart_data(result)
    return result


def excel_rows(result: dict[str, Any]) -> list[list[Any]]:
    keys = ("malicious", "benign", "tp", "fn", "fp", "tn", "alerts", "p_malicious_given_alarm")
    out: list[list[Any]] = [["Quantity", "Expected", "Simulated"]]
    for k in keys:
        out.append([k, result["expected"][k], (result["simulated"] or {}).get(k)])
    return out


__all__ = ["DEFAULTS", "LABELS", "ValidationError", "validate", "expected", "monte_carlo", "compare", "simulate", "chart_data", "excel_rows"]
