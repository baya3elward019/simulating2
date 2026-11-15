from ...registry import SimulationModel
from .engine import DEFAULTS, chart_data, compare, excel_rows, expected, monte_carlo, simulate, validate  # noqa: F401


def _workbook(params=None):
    from .excel import build_workbook  # openpyxl is imported only when exporting
    return build_workbook(params)


MODEL = SimulationModel(
    id="ids",
    title=("IDS Detection & Bayesian Probability", "كشف التسلل واحتمال بايز (IDS)"),
    defaults=DEFAULTS,
    validate=validate,
    simulate=simulate,
    build_workbook=_workbook,
    filename="simulab-ids-bayes.xlsx",
)
