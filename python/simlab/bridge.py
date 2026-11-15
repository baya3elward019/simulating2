"""JSON boundary between the web page (Pyodide worker) and the Python engines.

Only registered model ids and JSON parameters cross this boundary — no user-supplied Python is
ever executed. Every call returns a JSON string: {"ok": true, ...} or {"ok": false, "errors": [...]}.
"""
from __future__ import annotations

import json
import math
from typing import Any

from .registry import all_models, get
from .validation import ValidationError


def _clean(value: Any) -> Any:
    """Make results strict-JSON safe (no NaN/Infinity)."""
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_clean(v) for v in value]
    return value


def _guard(fn):
    def wrapper(*args):
        try:
            return json.dumps({"ok": True, **fn(*args)}, ensure_ascii=False, allow_nan=False)
        except ValidationError as e:
            return json.dumps({"ok": False, "errors": e.errors}, ensure_ascii=False)
        except KeyError as e:
            return json.dumps({"ok": False, "errors": [{"field": "*", "en": str(e.args[0]), "ar": "نموذج غير معروف."}]}, ensure_ascii=False)
        except Exception as e:  # pragma: no cover - unexpected engine failure
            return json.dumps({"ok": False, "errors": [{"field": "*", "en": f"{type(e).__name__}: {e}", "ar": "حدث خطأ غير متوقع في محرك Python."}]}, ensure_ascii=False)
    return wrapper


@_guard
def models() -> dict[str, Any]:
    return {"models": [m.describe() for m in all_models()]}


@_guard
def run(model_id: str, params_json: str) -> dict[str, Any]:
    params = json.loads(params_json or "{}")
    return {"result": _clean(get(model_id).simulate(params))}


@_guard
def export(model_id: str, params_json: str, path: str) -> dict[str, Any]:
    model = get(model_id)
    params = json.loads(params_json or "{}")
    model.validate(params)
    model.build_workbook(params).save(path)
    return {"path": path, "filename": model.filename}
