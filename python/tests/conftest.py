import shutil
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

SOFFICE = shutil.which("soffice") or shutil.which("libreoffice")


@pytest.fixture
def recalc(tmp_path):
    """Return a function that recalculates an .xlsx in LibreOffice and opens the cached values."""
    if not SOFFICE:
        pytest.skip("LibreOffice is not installed; Excel recalculation tests skipped")
    import openpyxl

    def run(path: Path):
        out = tmp_path / f"recalc-{path.stem}"
        out.mkdir(exist_ok=True)
        subprocess.run([SOFFICE, "--headless", "--calc", "--convert-to", "xlsx", "--outdir", str(out), str(path)],
                       check=True, capture_output=True, timeout=180)
        return openpyxl.load_workbook(out / path.name, data_only=True)
    return run
