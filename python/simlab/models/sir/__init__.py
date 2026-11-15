from ...registry import SimulationModel
from .engine import DEFAULTS, chart_data, excel_rows, simulate, validate  # noqa: F401


def _workbook(params=None):
    from .excel import build_workbook  # openpyxl is imported only when exporting
    return build_workbook(params)


MODEL = SimulationModel(
    id="sir",
    title=("SIR Malware Propagation", "انتشار البرمجيات الخبيثة (SIR)"),
    defaults=DEFAULTS,
    validate=validate,
    simulate=simulate,
    build_workbook=_workbook,
    filename="simulab-sir-malware.xlsx",
)
