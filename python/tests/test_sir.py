import pytest

from simlab.models.sir import engine as sir
from simlab.validation import ValidationError


def test_day_one_matches_the_worked_solution():
    r = sir.simulate()
    d1 = r["rows"][1]
    assert d1["new_infections"] == pytest.approx(1.99, abs=1e-12)
    assert d1["recoveries"] == pytest.approx(0.5, abs=1e-12)
    assert d1["S"] == pytest.approx(993.01, abs=1e-12)
    assert d1["I"] == pytest.approx(6.49, abs=1e-12)
    assert d1["R"] == pytest.approx(0.5, abs=1e-12)


def test_every_day_uses_the_previous_day_and_is_not_rounded():
    r = sir.simulate({"days": 3})
    d1, d2 = r["rows"][1], r["rows"][2]
    assert d2["new_infections"] == 0.4 * d1["S"] * d1["I"] / 1000          # exact, not 0.4*993.01*6.49 rounded
    assert d2["S"] == pytest.approx(990.43214604, abs=1e-9)
    assert len(r["rows"]) == 4 and r["rows"][0]["new_infections"] is None


def test_population_is_conserved_for_long_runs():
    r = sir.simulate({"days": 365, "beta": 0.9, "gamma": 0.05})
    assert r["summary"]["conserved"]
    assert r["summary"]["max_conservation_error"] < 1e-9
    assert all(row["S"] >= 0 and row["I"] >= 0 and row["R"] >= 0 for row in r["rows"])


def test_summary_and_chart_data():
    r = sir.simulate({"days": 120})
    s = r["summary"]
    assert s["basic_reproduction_number"] == pytest.approx(4)
    assert 0 < s["peak_day"] < 120
    assert s["peak_infected"] == max(row["I"] for row in r["rows"])
    assert s["cumulative_new_infections"] == pytest.approx(995 - s["final"]["S"])
    assert len(r["chart"]) == 121 and set(r["chart"][0]) == {"day", "S", "I", "R", "new_infections", "recoveries"}


def test_no_infection_edge_case():
    r = sir.simulate({"S0": 1000, "I0": 0, "R0": 0})
    assert all(row["I"] == 0 and row["S"] == 1000 for row in r["rows"])
    assert r["summary"]["peak_infected"] == 0


def test_gamma_zero_has_no_reproduction_number_and_decimals_work():
    r = sir.simulate({"N": 10.5, "S0": 10, "I0": 0.5, "R0": 0, "gamma": 0, "beta": 0.25})
    assert r["summary"]["basic_reproduction_number"] is None
    assert r["rows"][1]["new_infections"] == pytest.approx(0.25 * 10 * 0.5 / 10.5)


@pytest.mark.parametrize("params, field", [
    ({"N": 0}, "N"), ({"N": -5}, "N"), ({"I0": -1}, "I0"), ({"S0": 990}, "S0"),
    ({"beta": 1.5}, "beta"), ({"gamma": -0.1}, "gamma"), ({"days": 2.5}, "days"), ({"days": 0}, "days"),
    ({"days": 1000}, "days"), ({"beta": "abc"}, "beta"), ({"beta": None}, "beta"), ({"beta": float("nan")}, "beta"),
    ({"beta": True}, "beta"),
])
def test_invalid_inputs_are_rejected(params, field):
    with pytest.raises(ValidationError) as e:
        sir.simulate(params)
    assert field in {err["field"] for err in e.value.errors}
    assert all(err["en"] and err["ar"] for err in e.value.errors)


def test_numeric_strings_are_accepted():
    assert sir.simulate({"beta": "0.4", "days": "5"})["rows"][1]["S"] == pytest.approx(993.01)
