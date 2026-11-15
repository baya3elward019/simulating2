"""Modular model registry.

A model is a self-contained package under ``simlab/models/<id>/`` that exposes one
:class:`SimulationModel`. It owns its inputs (``defaults``), validation, calculation engine,
chart data and Excel export. Adding a future model (M/M/1, network traffic, risk…) means
adding one package and one line in :func:`_load_builtin_models` — nothing else changes.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class SimulationModel:
    id: str
    title: tuple[str, str]                      # (English, Arabic)
    defaults: dict[str, Any]
    validate: Callable[[dict[str, Any] | None], dict[str, Any]]
    simulate: Callable[[dict[str, Any] | None], dict[str, Any]]
    build_workbook: Callable[[dict[str, Any] | None], Any]   # returns an openpyxl Workbook
    filename: str

    def describe(self) -> dict[str, Any]:
        return {"id": self.id, "title": list(self.title), "defaults": self.defaults, "filename": self.filename}


_MODELS: dict[str, SimulationModel] = {}


def register(model: SimulationModel) -> SimulationModel:
    if model.id in _MODELS:
        raise ValueError(f"Model '{model.id}' is already registered.")
    _MODELS[model.id] = model
    return model


def _load_builtin_models() -> None:
    if _MODELS:
        return
    from .models.sir import MODEL as sir
    from .models.ids import MODEL as ids
    for m in (sir, ids):
        register(m)


def get(model_id: str) -> SimulationModel:
    _load_builtin_models()
    try:
        return _MODELS[model_id]
    except KeyError:
        raise KeyError(f"Unknown model '{model_id}'. Available: {', '.join(sorted(_MODELS))}") from None


def all_models() -> list[SimulationModel]:
    _load_builtin_models()
    return list(_MODELS.values())
