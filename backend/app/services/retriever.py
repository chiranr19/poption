# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Event-corpus retriever.

The LLM's forensic explanations are grounded in two things: (1) the anomaly's
own numbers, and (2) a handful of historical analogues from the curated event
corpus. This module handles (2).

We deliberately avoid ChromaDB / OpenAI embeddings for now:
- The corpus is ~20 entries. Building an ANN index over 20 vectors is comedy.
- Keeping retrieval pure-numpy means the app boots in <1 second, works offline,
  and has no per-request API dependency.
- The :class:`Retriever` interface is one method — swapping to a real vector
  store later means writing another 40-line class.

Scoring is tag-overlap weighted by an anomaly-kind → relevant-tag map. Simple,
inspectable, and — importantly — deterministic: same anomaly ⇒ same analogues,
so LLM output stays reproducible.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from ..models import Anomaly


CORPUS_PATH = Path(__file__).resolve().parent.parent / "data" / "event_corpus.json"


# What each anomaly kind should look up analogues for. Tags reference the
# corpus entries' `tags` field.
KIND_TAG_WEIGHTS: dict[str, dict[str, float]] = {
    "iv_spike": {
        "iv_regime_shift": 3.0,
        "vega_squeeze": 2.5,
        "volatility_regime_change": 2.5,
        "iv_crush": 2.0,
        "iv_persistent_elevated": 2.0,
        "crash": 1.5,
        "exogenous_shock": 1.5,
    },
    "pc_ratio_shift": {
        "put_demand": 3.0,
        "call_frenzy": 3.0,
        "short_squeeze": 2.5,
        "credit": 1.5,
        "bank_failure": 1.5,
    },
    "vol_oi_divergence": {
        "call_frenzy": 3.0,
        "short_squeeze": 3.0,
        "retail": 2.0,
        "microstructure": 2.0,
        "liquidity_evaporation": 2.0,
    },
}


@dataclass(frozen=True)
class Analogue:
    """One retrieved historical event, with the score that surfaced it."""

    id: str
    title: str
    date: str
    lesson: str
    score: float
    tags: list[str]


class Retriever:
    """Loads the corpus once at construction, scores per anomaly on demand."""

    def __init__(self, corpus_path: Path | None = None) -> None:
        path = corpus_path or CORPUS_PATH
        with path.open(encoding="utf-8") as f:
            self._data = json.load(f)
        self._events: list[dict] = self._data["events"]

    def find_analogues(self, anomaly: Anomaly, top_k: int = 3) -> list[Analogue]:
        """Rank the corpus for this anomaly; return the top-k with score > 0."""
        weights = KIND_TAG_WEIGHTS.get(anomaly.kind, {})
        scored: list[tuple[float, dict]] = []
        for ev in self._events:
            score = sum(weights.get(tag, 0.0) for tag in ev.get("tags", []))
            # Regime bonus: analogues from the same regime score higher.
            ev_regime = (ev.get("signature") or {}).get("regime")
            # (context is the anomaly's payload; regime lives in snapshot, but
            # we pass the anomaly here — carry it through context when we can.)
            snap_regime = anomaly.context.get("regime")  # optional; set by caller
            if snap_regime and ev_regime == snap_regime:
                score += 1.0
            if score > 0:
                scored.append((score, ev))

        scored.sort(key=lambda x: (-x[0], x[1]["date"]))
        out: list[Analogue] = []
        for score, ev in scored[:top_k]:
            out.append(
                Analogue(
                    id=ev["id"],
                    title=ev["title"],
                    date=ev["date"],
                    lesson=ev["lesson"],
                    score=round(score, 1),
                    tags=list(ev.get("tags", [])),
                )
            )
        return out
