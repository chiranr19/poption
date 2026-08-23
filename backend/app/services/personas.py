# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Persona-trade corpus loader.

Serves the concrete opinionated trade structures a specific desk archetype
would typically put on for each anomaly kind. Content is deliberately
third-person portraits of professional behavior — descriptions of what pros
typically do, never second-person instructions to the reader.

The FORBIDDEN regex from ``services.forensics`` scans this file's text at
test time (see ``tests/test_personas.py``) so the copy can't drift into
advice without failing the build.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

PERSONAS_PATH = Path(__file__).resolve().parent.parent / "data" / "personas.json"

_cache: dict[str, Any] | None = None


def _load() -> dict[str, Any]:
    global _cache
    if _cache is None:
        with PERSONAS_PATH.open(encoding="utf-8") as f:
            _cache = json.load(f)
    return _cache


def list_personas() -> dict[str, dict[str, str]]:
    """{persona_key: {title, philosophy}} for the three desks."""
    return dict(_load()["personas"])


def trades_for_kind(kind: str) -> dict[str, dict[str, Any]] | None:
    """Every persona's trade for a given anomaly kind, or None if unknown."""
    trades = _load()["trades"]
    return trades.get(kind)


def persona_bundle(kind: str) -> dict[str, Any] | None:
    """The API-shaped payload: persona metadata + trades merged in one dict."""
    trades = trades_for_kind(kind)
    if trades is None:
        return None
    personas = list_personas()
    rows: list[dict[str, Any]] = []
    for pkey, meta in personas.items():
        trade = trades.get(pkey)
        if trade is None:
            continue
        rows.append({"persona": pkey, **meta, **trade})
    return {"kind": kind, "personas": rows}


def all_text_for_copy_check() -> str:
    """Concatenate every string in the corpus so the FORBIDDEN regex has one
    blob to walk. Used only by tests."""
    data = _load()
    chunks: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, str):
            chunks.append(node)
        elif isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(data)
    return "\n".join(chunks)
