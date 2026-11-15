"""SimuLab · Simulation Lab — Python simulation engines.

The same package runs in two places:
* in the browser, inside Pyodide (WebAssembly), driven by ``simlab.bridge``;
* on a desktop, from the command line: ``python -m simlab sir --xlsx sir.xlsx``.
"""
from .registry import all_models, get
from .validation import ValidationError

__all__ = ["all_models", "get", "ValidationError"]
__version__ = "1.0.0"
