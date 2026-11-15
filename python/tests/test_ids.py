import pytest

from simlab.models.ids import engine as ids
from simlab.validation import ValidationError

CASE_1 = dict(malicious=500, benign=9500, tp=495, fn=5, fp=475, tn=9025, alerts=970)
CASE_2 = dict(malicious=100, benign=9900, tp=99, fn=1, fp=495, tn=9405, alerts=594)


@pytest.mark.parametrize("pct, counts, ppv", [(5, CASE_1, 0.5103), (1, CASE_2, 0.1667)])
def test_expected_results_match_the_question(pct, counts, ppv):
    e = ids.simulate({"malicious_pct": pct})["expected"]
    for key, value in counts.items():
        assert e[key] == pytest.approx(value, abs=1e-9), key
    assert e["p_malicious_given_alarm"] == pytest.approx(ppv, abs=5e-5)
    assert e["bayes"]["posterior"] == pytest.approx(e["p_malicious_given_alarm"], abs=1e-12)   # Bayes = counts


def test_default_comparison_is_5_vs_1_percent():
    comp = ids.simulate()["comparison"]
    assert [c["inputs"]["malicious_pct"] for c in comp] == [5, 1]
    assert comp[1]["inputs"]["tpr_pct"] == 99 and comp[1]["inputs"]["packets"] == 10000   # inherited
    assert comp[1]["expected"]["p_malicious_given_alarm"] == pytest.approx(99 / 594)


def test_no_alarms_is_handled_without_division_by_zero():
    e = ids.simulate({"tpr_pct": 0, "fpr_pct": 0})["expected"]
    assert e["alerts"] == 0 and e["p_malicious_given_alarm"] is None and e["bayes"]["posterior"] is None and e["f1"] is None
    e = ids.simulate({"malicious_pct": 0, "fpr_pct": 0})["expected"]
    assert e["p_malicious_given_alarm"] is None


def test_all_malicious_has_no_negatives():
    e = ids.simulate({"malicious_pct": 100, "tpr_pct": 100})["expected"]
    assert e["p_benign_given_no_alarm"] is None and e["p_malicious_given_alarm"] == 1


def test_monte_carlo_is_reproducible_and_consistent():
    a = ids.simulate({"monte_carlo": True, "seed": "lab"})["simulated"]
    b = ids.simulate({"monte_carlo": True, "seed": "lab"})["simulated"]
    c = ids.simulate({"monte_carlo": True, "seed": "other"})["simulated"]
    assert a == b and a != c
    assert a["tp"] + a["fn"] + a["fp"] + a["tn"] == 10000
    assert len(a["sample"]) == 25 and {s["outcome"] for s in a["sample"]} <= {"TP", "FN", "FP", "TN"}


def test_monte_carlo_converges_to_expected():
    r = ids.simulate({"packets": 400000, "monte_carlo": True, "seed": 7})
    sim, exp = r["simulated"], r["expected"]
    assert sim["p_malicious_given_alarm"] == pytest.approx(exp["p_malicious_given_alarm"], abs=3 * sim["ppv_margin95"])
    assert sim["malicious"] == pytest.approx(exp["malicious"], rel=0.03)


@pytest.mark.parametrize("params, field", [
    ({"malicious_pct": 101}, "malicious_pct"), ({"tpr_pct": -1}, "tpr_pct"), ({"packets": 0}, "packets"),
    ({"packets": 10.5}, "packets"), ({"fpr_pct": "x"}, "fpr_pct"),
    ({"packets": 2_000_000, "monte_carlo": True}, "packets"),
    ({"scenarios": [{"malicious_pct": 150}]}, "scenarios.0.malicious_pct"),
])
def test_invalid_inputs(params, field):
    with pytest.raises(ValidationError) as e:
        ids.simulate(params)
    assert field in {err["field"] for err in e.value.errors}


def test_decimal_rates():
    e = ids.simulate({"packets": 1000, "malicious_pct": 0.5, "tpr_pct": 97.5, "fpr_pct": 2.25})["expected"]
    assert e["tp"] == pytest.approx(5 * 0.975) and e["fp"] == pytest.approx(995 * 0.0225)
