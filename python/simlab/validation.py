"""Shared input validation for every Simulation Lab model.

Each model declares its fields with :class:`Checker`; errors are collected (not raised one by
one) so the web UI can show every problem next to the right input at once. Messages are
bilingual (English / Arabic) because the platform is.
"""
from __future__ import annotations

import math
from typing import Any


class ValidationError(Exception):
    """Raised when user input is invalid. ``errors`` is a list of {field, en, ar} dicts."""

    def __init__(self, errors: list[dict[str, str]]):
        self.errors = errors
        super().__init__("; ".join(e["en"] for e in errors))


def _fmt(x: float) -> str:
    return str(int(x)) if float(x).is_integer() else f"{x:g}"


class Checker:
    """Collects cleaned values and validation errors for one set of parameters."""

    def __init__(self, raw: dict[str, Any] | None, defaults: dict[str, Any]):
        if raw is not None and not isinstance(raw, dict):
            raise ValidationError([{"field": "*", "en": "Parameters must be an object.", "ar": "يجب أن تكون المدخلات كائناً."}])
        self.raw = raw or {}
        self.defaults = defaults
        self.clean: dict[str, Any] = {}
        self.errors: list[dict[str, str]] = []

    def fail(self, field: str, en: str, ar: str) -> None:
        self.errors.append({"field": field, "en": en, "ar": ar})

    def number(self, key: str, label: tuple[str, str], *, minimum: float | None = None, maximum: float | None = None,
               integer: bool = False, positive: bool = False) -> float | None:
        value = self.raw.get(key, self.defaults.get(key))
        en, ar = label
        if isinstance(value, bool) or value is None or (isinstance(value, str) and not value.strip()):
            self.fail(key, f"{en} is required and must be a number.", f"{ar}: القيمة مطلوبة ويجب أن تكون رقماً.")
            return None
        try:
            number = float(value)
        except (TypeError, ValueError):
            self.fail(key, f"{en} must be a number.", f"{ar}: يجب أن تكون القيمة رقماً.")
            return None
        if not math.isfinite(number):
            self.fail(key, f"{en} must be a finite number.", f"{ar}: يجب أن تكون القيمة رقماً محدوداً.")
            return None
        if integer and not number.is_integer():
            self.fail(key, f"{en} must be a whole number.", f"{ar}: يجب أن تكون القيمة عدداً صحيحاً.")
            return None
        if positive and number <= 0:
            self.fail(key, f"{en} must be greater than 0.", f"{ar}: يجب أن تكون القيمة أكبر من 0.")
            return None
        lo = minimum if minimum is not None else -math.inf
        hi = maximum if maximum is not None else math.inf
        if number < lo or number > hi:
            if maximum is None:
                self.fail(key, f"{en} cannot be less than {_fmt(lo)}.", f"{ar}: لا يمكن أن تكون أقل من {_fmt(lo)}.")
            else:
                self.fail(key, f"{en} must be between {_fmt(lo)} and {_fmt(hi)}.", f"{ar}: يجب أن تكون بين {_fmt(lo)} و {_fmt(hi)}.")
            return None
        result = int(number) if integer else number
        self.clean[key] = result
        return result

    def text(self, key: str, label: tuple[str, str], *, max_length: int = 64) -> str | None:
        value = self.raw.get(key, self.defaults.get(key))
        value = "" if value is None else str(value)
        if len(value) > max_length:
            self.fail(key, f"{label[0]} must be at most {max_length} characters.", f"{label[1]}: الحد الأقصى {max_length} حرفاً.")
            return None
        self.clean[key] = value
        return value

    def flag(self, key: str) -> bool:
        value = bool(self.raw.get(key, self.defaults.get(key, False)))
        self.clean[key] = value
        return value

    def done(self) -> dict[str, Any]:
        if self.errors:
            raise ValidationError(self.errors)
        return self.clean
