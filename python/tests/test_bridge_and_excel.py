import json

import openpyxl
import pytest

from simlab import bridge
from simlab.models.ids import engine as ids
from simlab.models.sir import engine as sir
from simlab.registry import get


def test_bridge_returns_strict_json():
    ok = json.loads(bridge.run("sir", json.dumps({"days": 2})))
    assert ok["ok"] and len(ok["result"]["rows"]) == 3
    bad = json.loads(bridge.run("sir", json.dumps({"beta": 7})))
    assert not bad["ok"] and bad["errors"][0]["field"] == "beta"
    unknown = json.loads(bridge.run("nope", "{}"))
    assert not unknown["ok"]
    none_ppv = json.loads(bridge.run("ids", json.dumps({"tpr_pct": 0, "fpr_pct": 0})))
    assert none_ppv["result"]["expected"]["p_malicious_given_alarm"] is None
    assert {m["id"] for m in json.loads(bridge.models())["models"]} == {"sir", "ids"}


def test_bridge_export_writes_file(tmp_path):
    out = tmp_path / "x.xlsx"
    res = json.loads(bridge.export("ids", json.dumps({"monte_carlo": True}), str(out)))
    assert res["ok"] and out.stat().st_size > 5000
    assert not json.loads(bridge.export("ids", json.dumps({"packets": -3}), str(tmp_path / "y.xlsx")))["ok"]


def _save(model, params, path):
    get(model).build_workbook(params).save(path)
    return path


def test_sir_workbook_structure_uses_real_formulas(tmp_path):
    wb = openpyxl.load_workbook(_save("sir", {}, tmp_path / "sir.xlsx"))
    assert wb.sheetnames == ["Inputs", "SIR Simulation", "Charts"]
    ws = wb["SIR Simulation"]
    assert ws["E6"].value == "=InfectionRate*B5*C5/TotalDevices"
    assert ws["B6"].value == "=B5-E6" and ws["C6"].value == "=C5+E6-F6" and ws["D6"].value == "=D5+F6"
    formulas = [c.value for row in ws.iter_rows(min_row=5, max_row=10, min_col=2, max_col=7) for c in row if c.value != "—"]
    assert formulas and all(str(v).startswith("=") for v in formulas)
    assert len(wb["Charts"]._charts) == 2
    assert {"TotalDevices", "InfectionRate", "RecoveryRate", "InitialS", "InitialI", "InitialR"} <= set(wb.defined_names)


def test_ids_workbook_structure(tmp_path):
    wb = openpyxl.load_workbook(_save("ids", {}, tmp_path / "ids.xlsx"))
    assert wb.sheetnames == ["Inputs", "Detection Results", "Bayes Calculation", "Scenario Comparison"]
    assert wb["Detection Results"]["C7"].value == "=C5*DetectionRate"
    assert len(wb["Scenario Comparison"]._charts) == 2


def _edit(path, sheet, values):
    wb = openpyxl.load_workbook(path)
    for ref, v in values.items():
        wb[sheet][ref] = v
    wb.save(path)


def test_sir_excel_matches_python_and_recalculates_after_editing_inputs(tmp_path, recalc):
    path = _save("sir", {"days": 30}, tmp_path / "sir.xlsx")
    wb = recalc(path)
    ws = wb["SIR Simulation"]
    for row in sir.simulate({"days": 30})["rows"]:
        r = 5 + row["day"]
        for col, key in ((2, "S"), (3, "I"), (4, "R")):
            assert ws.cell(row=r, column=col).value == pytest.approx(row[key], abs=1e-9)
    # Change N, S0, I0, β and γ inside the workbook only — the formulas must follow.
    edited = {"N": 2000, "S0": 1990, "I0": 10, "R0": 0, "beta": 0.25, "gamma": 0.2, "days": 30}
    _edit(path, "Inputs", {"C5": 2000, "C6": 1990, "C7": 10, "C9": 0.25, "C10": 0.2})
    ws = recalc(path)["SIR Simulation"]
    expected = sir.simulate(edited)["rows"]
    for row in expected:
        assert ws.cell(row=5 + row["day"], column=3).value == pytest.approx(row["I"], abs=1e-9)
    assert ws["H35"].value == "✓"


def test_ids_excel_matches_python_edits_and_zero_alarms(tmp_path, recalc):
    path = _save("ids", {"monte_carlo": True, "seed": "x"}, tmp_path / "ids.xlsx")
    wb = recalc(path)
    exp = ids.simulate()["expected"]
    d = wb["Detection Results"]
    assert [d[f"C{r}"].value for r in range(5, 12)] == pytest.approx([exp[k] for k in ("malicious", "benign", "tp", "fn", "fp", "tn", "alerts")])
    assert wb["Bayes Calculation"]["C12"].value == pytest.approx(exp["p_malicious_given_alarm"], abs=1e-12)
    assert wb["Scenario Comparison"]["M6"].value == pytest.approx(99 / 594, abs=1e-12)
    sim = ids.simulate({"monte_carlo": True, "seed": "x"})["simulated"]
    assert d["D7"].value == sim["tp"] and d["E7"].value == pytest.approx(sim["tp"] - exp["tp"])

    _edit(path, "Inputs", {"B6": 0.01})                   # case 2 typed into Excel
    assert recalc(path)["Bayes Calculation"]["C12"].value == pytest.approx(99 / 594, abs=1e-12)
    _edit(path, "Inputs", {"B7": 0, "B8": 0})              # no alarms at all
    wb = recalc(path)
    assert wb["Bayes Calculation"]["C12"].value == "N/A – no alarms"
    assert wb["Detection Results"]["C13"].value == "N/A – no alarms"
