"""Command line: run any registered model and optionally write its Excel workbook.

    cd python
    python -m simlab list
    python -m simlab sir                                  # defaults, prints the day table
    python -m simlab sir --set beta=0.3 --set days=30 --xlsx sir.xlsx
    python -m simlab ids --set malicious_pct=1 --set monte_carlo=true --xlsx ids.xlsx
    python -m simlab ids --json                           # full JSON result
"""
from __future__ import annotations

import argparse
import json
import sys

from .registry import all_models, get
from .validation import ValidationError


def _value(text: str):
    low = text.lower()
    if low in ("true", "false"):
        return low == "true"
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def _print_table(rows) -> None:
    def show(v):
        if v is None:
            return "—"
        if isinstance(v, float):
            return f"{v:,.4f}"
        return str(v)
    cells = [[show(v) for v in row] for row in rows]
    width = [max(len(r[i]) for r in cells) for i in range(len(cells[0]))]
    for j, row in enumerate(cells):
        print(" | ".join(c.rjust(w) for c, w in zip(row, width)))
        if j == 0:
            print("-+-".join("-" * w for w in width))


def main(argv: list[str] | None = None) -> int:
    ids = [m.id for m in all_models()]
    ap = argparse.ArgumentParser(prog="python -m simlab", description="SimuLab Simulation Lab engines")
    ap.add_argument("model", choices=[*ids, "list"])
    ap.add_argument("--set", action="append", default=[], metavar="KEY=VALUE", help="override one input (repeatable)")
    ap.add_argument("--params", help="JSON object with inputs")
    ap.add_argument("--xlsx", help="write the Excel workbook with live formulas to this path")
    ap.add_argument("--json", action="store_true", help="print the full JSON result")
    args = ap.parse_args(argv)
    if args.model == "list":
        for m in all_models():
            print(f"{m.id:6} {m.title[0]}  ·  defaults: {json.dumps(m.defaults, ensure_ascii=False)}")
        return 0
    model = get(args.model)
    params = json.loads(args.params) if args.params else {}
    for item in args.set:
        key, _, raw = item.partition("=")
        params[key.strip()] = _value(raw.strip())
    try:
        result = model.simulate(params)
        if args.xlsx:
            model.build_workbook(params).save(args.xlsx)
    except ValidationError as e:
        for err in e.errors:
            print(f"✗ {err['field']}: {err['en']}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        module = sys.modules[model.simulate.__module__]
        _print_table(module.excel_rows(result))
    if args.xlsx:
        print(f"\nSaved {args.xlsx}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
