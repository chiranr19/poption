# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Detector correctness — fires on planted anomalies, silent on calm data."""

from __future__ import annotations

import pytest

from app.services.detector import (
    DetectorState,
    RollingWindow,
    _confidence,
    _confidence_score,
    evaluate,
)
from app.services.simulator import MarketSimulator


# --------------------------------------------------------------------------- #
# RollingWindow primitives
# --------------------------------------------------------------------------- #


def test_rolling_window_returns_none_until_min_samples():
    w = RollingWindow(maxlen=100)
    for _ in range(10):
        w.push(1.0)
    assert w.zscore(2.0) is None


def test_rolling_window_zscore_shape():
    w = RollingWindow(maxlen=100)
    for _ in range(25):
        w.push(1.0)
    # Zero std — undefined z-score; None is the safe answer.
    assert w.zscore(2.0) is None
    # Add variation.
    for v in [1.1, 0.9, 1.2, 0.8, 1.05, 0.95]:
        w.push(v)
    z = w.zscore(2.0)
    assert z is not None and z > 0


def test_rolling_window_respects_maxlen():
    w = RollingWindow(maxlen=5)
    for v in range(10):
        w.push(v)
    assert len(w.values) == 5
    assert list(w.values) == [5, 6, 7, 8, 9]


# --------------------------------------------------------------------------- #
# End-to-end detector behavior
# --------------------------------------------------------------------------- #


def test_detector_is_silent_on_calm_data():
    """The most important correctness check: 200 calm-regime ticks must
    produce zero anomalies. If this fails, the detector's threshold is wrong
    and the app will scream at the user forever."""
    sim = MarketSimulator(seed=11)
    sim.set_regime("calm")
    state = DetectorState()
    total = 0
    for _ in range(200):
        snap = sim.tick()
        total += len(evaluate(state, snap))
    assert total == 0, f"detector fired {total} times on calm data"


def test_detector_fires_on_planted_put_bias_spike():
    """Warm the window with 60 calm ticks, then plant one huge put bias.
    The P/C detector should catch it."""
    sim = MarketSimulator(seed=13)
    sim.set_regime("normal")
    state = DetectorState()

    # Warm-up.
    for _ in range(60):
        evaluate(state, sim.tick())

    # Plant a strong put bias for the next tick.
    sim.state.put_bias_extra = 0.65
    fired = evaluate(state, sim.tick())
    kinds = [a.kind for a in fired]
    assert "pc_ratio_shift" in kinds


def test_detector_fires_on_regime_switch_to_stressed():
    """Warm on 'normal' then flip to 'stressed'. IV bump should spike."""
    sim = MarketSimulator(seed=17)
    state = DetectorState()
    for _ in range(80):
        evaluate(state, sim.tick())

    sim.set_regime("stressed")
    # Give the regime one tick to actually show up in the snapshot.
    fired: list = []
    for _ in range(3):
        fired.extend(evaluate(state, sim.tick()))

    assert any(a.kind == "iv_spike" for a in fired), (
        f"expected iv_spike on regime flip, got kinds={[a.kind for a in fired]}"
    )


def test_anomaly_dedupe_prevents_double_fire():
    """A repeated evaluate() at the same ts must not produce two Anomaly rows
    with the same ID."""
    sim = MarketSimulator(seed=19)
    state = DetectorState()
    for _ in range(70):
        evaluate(state, sim.tick())

    sim.state.put_bias_extra = 0.8
    snap = sim.tick()
    first = evaluate(state, snap)
    # Same snapshot again (never happens in the pipeline, but the guard must exist).
    second = evaluate(state, snap)
    ids_first = {a.id for a in first}
    ids_second = {a.id for a in second}
    assert not (ids_first & ids_second), "detector re-fired an anomaly with the same id"


# --------------------------------------------------------------------------- #
# Confidence scoring — the "no naked gauge" rule
# --------------------------------------------------------------------------- #


def test_confidence_factors_are_all_populated():
    factors = _confidence(z=4.5, threshold=3.0, n_samples=50, regime="normal")
    for field_name in ("magnitude", "sample", "regime"):
        v = getattr(factors, field_name)
        assert 0 <= v <= 100, f"{field_name}={v} out of range"


def test_confidence_score_is_weighted_blend():
    """A perfect signal on every dimension → 100. Zero on every dimension → 0."""
    from app.models import ConfidenceFactors

    top = ConfidenceFactors(magnitude=100, sample=100, regime=100)
    zero = ConfidenceFactors(magnitude=0, sample=0, regime=0)
    assert _confidence_score(top) == 100.0
    assert _confidence_score(zero) == 0.0


def test_confidence_discounts_stressed_regime():
    """Same z-score/samples, but stressed regime → lower confidence than calm.
    This is the mechanism that stops the detector from screaming during a
    crisis when everything is noisy."""
    calm = _confidence(z=4.5, threshold=3.0, n_samples=50, regime="calm")
    stressed = _confidence(z=4.5, threshold=3.0, n_samples=50, regime="stressed")
    assert calm.regime > stressed.regime


def test_anomaly_carries_grounding_context():
    """Every Anomaly's context dict must be non-empty — the LLM will cite from it."""
    sim = MarketSimulator(seed=23)
    state = DetectorState()
    for _ in range(70):
        evaluate(state, sim.tick())
    sim.state.put_bias_extra = 0.7
    fired = evaluate(state, sim.tick())
    assert fired, "expected at least one anomaly"
    for a in fired:
        assert a.context, f"{a.kind} shipped with empty context"
