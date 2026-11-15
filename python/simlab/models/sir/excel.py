"""SIR workbook: Inputs → SIR Simulation (live formulas) → Charts.

Every calculated cell is a real Excel formula that refers to the Inputs sheet through named
cells (TotalDevices, InfectionRate, RecoveryRate…). Change β, γ or N in Inputs and the whole
table and both charts update on recalculation (automatic in Excel; F9 forces it).
"""
from __future__ import annotations

from typing import Any

from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.worksheet.datavalidation import DataValidation

from ... import xlsx_style as st
from .engine import simulate

INPUTS, SIM, CHARTS = "Inputs", "SIR Simulation", "Charts"
COLORS = {"S": "6687FF", "I": "FF6B6B", "R": "2FBF9F"}
FIRST = 5  # first data row (Day 0) on the simulation sheet


def build_workbook(params: dict[str, Any] | None = None) -> Workbook:
    result = simulate(params)
    p = result["inputs"]
    wb = Workbook()
    _inputs(wb, wb.active, p)
    last = _simulation(wb, wb.create_sheet(SIM), p, result)
    _charts(wb, wb.create_sheet(CHARTS), last)
    st.finish(wb)
    return wb


def _inputs(wb: Workbook, ws, p: dict[str, Any]) -> None:
    ws.title = INPUTS
    st.title(ws, "SIR Malware Propagation – Inputs  |  مدخلات نموذج انتشار البرمجيات الخبيثة",
             "Blue cells are editable. Excel recalculates automatically (F9 forces it).  الخلايا الزرقاء قابلة للتعديل.")
    st.header(ws, 4, ["Parameter / المتغير", "Symbol", "Value / القيمة", "Excel name", "Meaning / المعنى"])
    rows = [
        ("Total devices / إجمالي الأجهزة", "N", p["N"], "TotalDevices", "#,##0.########", "All devices in the network (N > 0)."),
        ("Susceptible at day 0 / المعرّضة", "S0", p["S0"], "InitialS", "#,##0.########", "Devices that can still be infected."),
        ("Infected at day 0 / المصابة", "I0", p["I0"], "InitialI", "#,##0.########", "Devices carrying the malware."),
        ("Recovered at day 0 / المتعافية", "R0", p["R0"], "InitialR", "#,##0.########", "Cleaned / patched devices (immune)."),
        ("Infection rate / معدل الإصابة", "β", p["beta"], "InfectionRate", "0.########", "Daily infection rate, 0 ≤ β ≤ 1."),
        ("Recovery rate / معدل التعافي", "γ", p["gamma"], "RecoveryRate", "0.########", "Daily share of infected devices that recover, 0 ≤ γ ≤ 1."),
    ]
    for i, (label, sym, value, name, fmt, meaning) in enumerate(rows):
        r = 5 + i
        st.cell(ws, r, 1, label, bold=True)
        st.cell(ws, r, 2, sym)
        st.cell(ws, r, 3, value, fmt=fmt, fill=st.INPUT_FILL)
        st.cell(ws, r, 4, name, mono=True)
        st.cell(ws, r, 5, meaning)
        st.define(wb, name, INPUTS, f"$C${r}")
    st.cell(ws, 11, 1, "Simulation days / عدد الأيام", bold=True)
    st.cell(ws, 11, 2, "D")
    st.cell(ws, 11, 3, p["days"], fill=st.STATIC_FILL)
    st.cell(ws, 11, 4, "SimDays", mono=True)
    st.cell(ws, 11, 5, "Fixed when exported: the simulation sheet has rows for Day 0…D. Export again from SimuLab to change it.")
    st.define(wb, "SimDays", INPUTS, "$C$11")

    st.header(ws, 13, ["Check / تحقق", "", "Result", "", "Formula"])
    checks = [
        ("S0 + I0 + R0 = N ?", '=IF(ABS(InitialS+InitialI+InitialR-TotalDevices)<=1E-9*MAX(1,TotalDevices),"OK ✓","Error: S0+I0+R0 ≠ N")'),
        ("0 ≤ β ≤ 1 and 0 ≤ γ ≤ 1 ?", '=IF(AND(InfectionRate>=0,InfectionRate<=1,RecoveryRate>=0,RecoveryRate<=1),"OK ✓","Error: β and γ must be in [0, 1]")'),
        ("Basic reproduction number ℛ₀ = β / γ", '=IF(RecoveryRate=0,"∞ (γ = 0)",InfectionRate/RecoveryRate)'),
    ]
    for i, (label, formula) in enumerate(checks):
        r = 14 + i
        st.cell(ws, r, 1, label, bold=True)
        st.cell(ws, r, 3, formula, fmt="0.00##")
        st.cell(ws, r, 5, formula[1:], mono=True)
    st.note(ws, 18, 1, "ℛ₀ > 1 means each infected device infects more than one other device on average, so the outbreak grows at first.")

    # Excel itself refuses impossible inputs.
    positive = DataValidation(type="decimal", operator="greaterThan", formula1="0", showErrorMessage=True,
                              errorTitle="Invalid N", error="N must be greater than 0.")
    nonneg = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", showErrorMessage=True,
                            errorTitle="Invalid value", error="Device counts cannot be negative.")
    rate = DataValidation(type="decimal", operator="between", formula1="0", formula2="1", showErrorMessage=True,
                          errorTitle="Invalid rate", error="Rates must be between 0 and 1.")
    for dv in (positive, nonneg, rate):
        ws.add_data_validation(dv)
    positive.add("C5"); nonneg.add("C6:C8"); rate.add("C9:C10")
    st.widths(ws, {"A": 36, "B": 9, "C": 16, "D": 18, "E": 70})
    ws.freeze_panes = "A5"


def _simulation(wb: Workbook, ws, p: dict[str, Any], result: dict[str, Any]) -> int:
    st.title(ws, "SIR Simulation – day by day  |  المحاكاة يوماً بيوم",
             "Each day is computed from the previous row only. Values are never rounded in the formulas; cells only display 2 decimals.")
    st.header(ws, 4, ["Day / اليوم", "S – Susceptible", "I – Infected", "R – Recovered",
                      "New infections\nβ·S·I/N", "Recoveries\nγ·I", "Total\nS+I+R", "Equals N?"])
    num = "#,##0.00"
    last = FIRST + p["days"]
    for d in range(p["days"] + 1):
        r = FIRST + d
        if d == 0:
            st.cell(ws, r, 1, 0, bold=True)
            st.cell(ws, r, 2, "=InitialS", fmt=num)
            st.cell(ws, r, 3, "=InitialI", fmt=num)
            st.cell(ws, r, 4, "=InitialR", fmt=num)
            st.cell(ws, r, 5, "—")
            st.cell(ws, r, 6, "—")
        else:
            q = r - 1
            st.cell(ws, r, 1, f"=A{q}+1", bold=True)
            st.cell(ws, r, 5, f"=InfectionRate*B{q}*C{q}/TotalDevices", fmt=num, fill=st.CALC_FILL)
            st.cell(ws, r, 6, f"=RecoveryRate*C{q}", fmt=num, fill=st.CALC_FILL)
            st.cell(ws, r, 2, f"=B{q}-E{r}", fmt=num)
            st.cell(ws, r, 3, f"=C{q}+E{r}-F{r}", fmt=num)
            st.cell(ws, r, 4, f"=D{q}+F{r}", fmt=num)
        st.cell(ws, r, 7, f"=B{r}+C{r}+D{r}", fmt=num)
        st.cell(ws, r, 8, f'=IF(ABS(G{r}-TotalDevices)<=1E-9*MAX(1,TotalDevices),"✓","✗")')

    # Summary (live) ---------------------------------------------------------------------
    st.header(ws, 4, ["Summary / الملخص", "Live value", "Excel formula"], col=10)
    rng_i = f"C{FIRST}:C{last}"
    summary = [
        ("Final susceptible S", f"=B{last}"),
        ("Final infected I", f"=C{last}"),
        ("Final recovered R", f"=D{last}"),
        ("Peak infected (max I)", f"=MAX({rng_i})"),
        ("Day of the peak", f"=INDEX(A{FIRST}:A{last},MATCH(MAX({rng_i}),{rng_i},0))"),
        ("Cumulative new infections", f"=SUM(E{FIRST + 1}:E{last})"),
        ("Cumulative recoveries", f"=SUM(F{FIRST + 1}:F{last})"),
        ("All days conserve N?", f'=IF(COUNTIF(H{FIRST}:H{last},"✗")=0,"Yes ✓","No ✗")'),
    ]
    for i, (label, formula) in enumerate(summary):
        r = 5 + i
        st.cell(ws, r, 10, label, bold=True)
        st.cell(ws, r, 11, formula, fmt=num)
        st.cell(ws, r, 12, formula[1:], mono=True)

    # Python cross-check (static) --------------------------------------------------------
    st.header(ws, 15, ["Python check (at export)", "Python value", "Excel − Python"], col=10)
    final = result["summary"]["final"]
    for i, (key, col) in enumerate((("S", "B"), ("I", "C"), ("R", "D"))):
        r = 16 + i
        st.cell(ws, r, 10, f"Final {key} computed by Python", bold=True)
        st.cell(ws, r, 11, final[key], fmt="#,##0.000000", fill=st.STATIC_FILL)
        st.cell(ws, r, 12, f"={col}{last}-K{r}", fmt="0.00E+00")
    st.note(ws, 19, 10, "Amber = static value written by the Python engine. The difference stays ≈ 0 until you edit Inputs.")

    # Formula guide -------------------------------------------------------------------------
    g = last + 3
    st.header(ws, g, ["Formula guide / دليل المعادلات", "", "", "Cell (Day 1 row)", "", "", "", ""])
    guide = [
        ("New infections = β × S × I / N", f"E{FIRST + 1}: =InfectionRate*B{FIRST}*C{FIRST}/TotalDevices"),
        ("Recoveries = γ × I", f"F{FIRST + 1}: =RecoveryRate*C{FIRST}"),
        ("S(next) = S − New infections", f"B{FIRST + 1}: =B{FIRST}-E{FIRST + 1}"),
        ("I(next) = I + New infections − Recoveries", f"C{FIRST + 1}: =C{FIRST}+E{FIRST + 1}-F{FIRST + 1}"),
        ("R(next) = R + Recoveries", f"D{FIRST + 1}: =D{FIRST}+F{FIRST + 1}"),
        ("Check: S + I + R = N every day", f"G{FIRST + 1}: =B{FIRST + 1}+C{FIRST + 1}+D{FIRST + 1}"),
    ]
    for i, (law, formula) in enumerate(guide):
        r = g + 1 + i
        ws.cell(row=r, column=1, value=law).font = st.Font(bold=True)
        ws.cell(row=r, column=4, value=formula).font = st.Font(name="Consolas", size=10)

    st.widths(ws, {"A": 11, "B": 17, "C": 15, "D": 15, "E": 16, "F": 14, "G": 14, "H": 7, "I": 3, "J": 32, "K": 16, "L": 52})
    ws.freeze_panes = "B5"
    return last


def _series_color(series, hex_color: str, line: bool) -> None:
    gp = series.graphicalProperties
    if line:
        gp.line.solidFill = hex_color
        gp.line.width = 28000
        series.smooth = False
    else:
        gp.solidFill = hex_color
        gp.line.solidFill = hex_color


def _charts(wb: Workbook, ws, last: int) -> None:
    st.title(ws, "Charts  |  الرسوم البيانية", "Both charts read the SIR Simulation sheet, so they update with the formulas.")
    data = wb[SIM]
    days = Reference(data, min_col=1, min_row=FIRST, max_row=last)

    line = LineChart()
    line.title = "S, I and R over time"
    line.y_axis.title = "Devices"
    line.x_axis.title = "Day"
    line.add_data(Reference(data, min_col=2, max_col=4, min_row=4, max_row=last), titles_from_data=True)
    line.set_categories(days)
    for s, key in zip(line.series, "SIR"):
        _series_color(s, COLORS[key], line=True)
    line.height, line.width = 9.5, 22
    line.x_axis.delete = False
    line.y_axis.delete = False
    ws.add_chart(line, "A4")

    bars = BarChart()
    bars.type = "col"
    bars.title = "Daily new infections vs recoveries"
    bars.add_data(Reference(data, min_col=5, max_col=6, min_row=4, max_row=last), titles_from_data=True)
    bars.set_categories(days)
    _series_color(bars.series[0], COLORS["I"], line=False)
    _series_color(bars.series[1], COLORS["R"], line=False)
    bars.height, bars.width = 8.5, 22
    bars.x_axis.delete = False
    bars.y_axis.delete = False
    ws.add_chart(bars, "A25")
