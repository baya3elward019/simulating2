"""Small openpyxl helpers shared by every model's Excel export (one consistent look)."""
from __future__ import annotations

from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.workbook.defined_name import DefinedName

NAVY = "FF1E2A4A"
INPUT_FILL = PatternFill("solid", fgColor="FFDDE8FF")      # blue = editable input
CALC_FILL = PatternFill("solid", fgColor="FFF6F8FC")
HEAD_FILL = PatternFill("solid", fgColor="FF1E2A4A")
STATIC_FILL = PatternFill("solid", fgColor="FFFFF4DE")     # amber = static value recorded by Python
THIN = Side(style="thin", color="FFC9D2E3")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def title(ws, text: str, subtitle: str = "") -> None:
    ws["A1"] = text
    ws["A1"].font = Font(bold=True, size=15, color=NAVY)
    if subtitle:
        ws["A2"] = subtitle
        ws["A2"].font = Font(italic=True, size=10, color="FF5B6782")


def header(ws, row: int, labels: list[str], col: int = 1) -> None:
    for i, label in enumerate(labels):
        c = ws.cell(row=row, column=col + i, value=label)
        c.font = Font(bold=True, color="FFFFFFFF")
        c.fill = HEAD_FILL
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BOX
    ws.row_dimensions[row].height = 34


def cell(ws, row: int, col: int, value, *, fmt: str | None = None, fill=None, bold: bool = False, mono: bool = False):
    c = ws.cell(row=row, column=col, value=value)
    c.border = BOX
    if fmt:
        c.number_format = fmt
    if fill is not None:
        c.fill = fill
    if bold or mono:
        c.font = Font(bold=bold, name="Consolas" if mono else None, size=10 if mono else 11)
    c.alignment = Alignment(vertical="center", wrap_text=isinstance(value, str) and not str(value).startswith("="))
    return c


def note(ws, row: int, col: int, text: str, *, italic: bool = True) -> None:
    c = ws.cell(row=row, column=col, value=text)
    c.font = Font(italic=italic, size=10, color="FF5B6782")
    c.alignment = Alignment(wrap_text=False, vertical="top")


def widths(ws, values: dict[str, float]) -> None:
    for col, w in values.items():
        ws.column_dimensions[col].width = w


def define(wb, name: str, sheet: str, ref: str) -> None:
    """Workbook-level name (e.g. InfectionRate → Inputs!$C$9) so formulas read like the law."""
    dn = DefinedName(name, attr_text=f"'{sheet}'!{ref}")
    wb.defined_names[name] = dn


def finish(wb) -> None:
    """Ask Excel/LibreOffice to recalculate every formula when the file is opened."""
    wb.calculation.fullCalcOnLoad = True
    wb.calculation.calcMode = "auto"
