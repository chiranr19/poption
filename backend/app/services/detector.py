"""Anomaly detector: rolling z-score signals with named-factor confidence.

Three detectors, each measuring a different mechanism the flow can spike on:

- **iv_spike**            — ATM implied vol jumping vs its recent rolling mean
- **pc_ratio_shift**      — put/call volume ratio (near-dated ATM strip)
                            moving multiple std-devs from its mean
- **vol_oi_divergence**   — today's volume unusually large vs open interest
                            (a "new positioning" signal — vets watch this
                            because OI hasn't caught up yet)

All state lives on a :class:`RollingWindow` per signal. The detector is a pure
function of (state + snapshot) → (updated state, optional Anomaly).

Confidence is a weighted blend of three named factors so no gauge is ever a
bare number:
  magnitude  — how far past the trigger threshold the z-score is
  sample     — how mature the rolling window is (thin → less trust)
  regime     — a discount when the simulator is in the stressed regime,
               where noise itself is elevated
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Literal

from ..config import (
    CONFIDENCE_WEIGHTS,
    IV_SPIKE_Z,
    IV_ZSCORE_WINDOW,
    MIN_SAMPLES,
    PC_RATIO_WINDOW,
    PC_SHIFT_Z,
    VOL_OI_WINDOW,
    VOL_OI_Z,
)
from ..models import Anomaly, ChainSnapshot, ConfidenceFactors
from .simulator import deterministic_id

AnomalyKind = Literal["iv_spike", "pc_ratio_shift", "vol_oi_divergence"]


# --------------------------------------------------------------------------- #
# Rolling stats
# --------------------------------------------------------------------------- #
@dataclass
class RollingWindow:
    """Bounded FIFO of floats with online-computed mean/std."""

    maxlen: int
    values: Deque[float] = field(default_factory=deque)

    def __post_init__(self) -> None:
        self.values = deque(maxlen=self.maxlen)

    def push(self, x: float) -> None:
        self.values.append(x)

    def stats(self) -> tuple[float, float, int]:
        """(mean, sample std, count). Std uses n-1 (Bessel) once n ≥ 2."""
        n = len(self.values)
        if n == 0:
            return 0.0, 0.0, 0
        mean = sum(self.values) / n
        if n < 2:
            return mean, 0.0, n
        var = sum((v - mean) ** 2 for v in self.values) / (n - 1)
        return mean, math.sqrt(var), n

    def zscore(self, x: float) -> float | None:
        """Z-score for x. None until we have a real std (n ≥ MIN_SAMPLES)."""
        mean, std, n = self.stats()
        if n < MIN_SAMPLES or std <= 0:
            return None
        return (x - mean) / std


# --------------------------------------------------------------------------- #
# Detector state — one per session
# --------------------------------------------------------------------------- #
@dataclass
class DetectorState:
    iv: RollingWindow = field(default_factory=lambda: RollingWindow(maxlen=IV_ZSCORE_WINDOW))
    pc_ratio: RollingWindow = field(default_factory=lambda: RollingWindow(maxlen=PC_RATIO_WINDOW))
    vol_oi: RollingWindow = field(default_factory=lambda: RollingWindow(maxlen=VOL_OI_WINDOW))
    fired_ids: set[str] = field(default_factory=set)


# --------------------------------------------------------------------------- #
# Feature extraction from a snapshot
# --------------------------------------------------------------------------- #
def _atm_iv(snap: ChainSnapshot, target_dte: int = 30) -> float | None:
    """ATM IV of the target-DTE call closest to spot. Returns None if not found."""
    calls = [q for q in snap.quotes if q.type == "call" and q.dte_days == target_dte]
    if not calls:
        return None
    atm = min(calls, key=lambda q: abs(q.strike - snap.spot))
    return atm.iv


def _put_call_volume_ratio(snap: ChainSnapshot, target_dte: int = 30) -> float | None:
    """Put/call volume ratio on the near-dated strip. None if there's no call volume
    (division by zero) — the regime rarely produces this in practice."""
    strip = [q for q in snap.quotes if q.dte_days == target_dte]
    pv = sum(q.volume for q in strip if q.type == "put")
    cv = sum(q.volume for q in strip if q.type == "call")
    if cv == 0:
        return None
    return pv / cv


def _vol_oi_ratio(snap: ChainSnapshot, target_dte: int = 30) -> float:
    """Total near-dated volume relative to open interest. A high ratio means
    new positioning is opening faster than existing positions can wind down."""
    strip = [q for q in snap.quotes if q.dte_days == target_dte]
    vol = sum(q.volume for q in strip)
    oi = sum(q.open_interest for q in strip)
    if oi == 0:
        return 0.0
    return vol / oi


# --------------------------------------------------------------------------- #
# Confidence scoring — the "no naked gauge" rule
# --------------------------------------------------------------------------- #
def _confidence(z: float, threshold: float, n_samples: int, regime: str) -> ConfidenceFactors:
    # Magnitude: 3σ over threshold saturates at 100.
    over = max(0.0, abs(z) - threshold)
    magnitude = min(100.0, 100.0 * over / 3.0 + 60.0 * (1.0 if abs(z) >= threshold else 0.0))
    # Sample: linear ramp from MIN_SAMPLES → window max (assumed 60).
    sample = min(100.0, 100.0 * (n_samples - MIN_SAMPLES) / max(1, IV_ZSCORE_WINDOW - MIN_SAMPLES))
    sample = max(0.0, sample)
    # Regime: stressed noise gets a discount; calm/normal don't.
    regime_score = {"calm": 100.0, "normal": 90.0, "stressed": 60.0}.get(regime, 80.0)
    return ConfidenceFactors(
        magnitude=round(magnitude, 1),
        sample=round(sample, 1),
        regime=round(regime_score, 1),
    )


def _confidence_score(factors: ConfidenceFactors) -> float:
    total = (
        factors.magnitude * CONFIDENCE_WEIGHTS["magnitude"]
        + factors.sample * CONFIDENCE_WEIGHTS["sample"]
        + factors.regime * CONFIDENCE_WEIGHTS["regime"]
    )
    return round(min(100.0, max(0.0, total)), 1)


# --------------------------------------------------------------------------- #
# The three detectors — pure fn (state, snap) → list[Anomaly]
# --------------------------------------------------------------------------- #
def _iv_anomaly(state: DetectorState, snap: ChainSnapshot) -> Anomaly | None:
    iv = _atm_iv(snap)
    if iv is None:
        return None
    z = state.iv.zscore(iv)
    # Update *after* the score so we're comparing today against yesterday's window.
    mean, std, n = state.iv.stats()
    state.iv.push(iv)
    if z is None or abs(z) < IV_SPIKE_Z:
        return None

    factors = _confidence(z, IV_SPIKE_Z, n, snap.regime)
    return Anomaly(
        id=deterministic_id(snap.symbol, snap.ts, "iv_spike"),
        ts=snap.ts,
        symbol=snap.symbol,
        kind="iv_spike",
        headline=f"ATM IV {iv:.1%} — {z:+.1f}σ vs {mean:.1%} baseline",
        z_score=round(z, 2),
        observed=round(iv, 4),
        baseline_mean=round(mean, 4),
        baseline_std=round(std, 4),
        confidence=_confidence_score(factors),
        factors=factors,
        context={"iv_current": round(iv, 4), "iv_baseline_mean": round(mean, 4),
                 "iv_baseline_std": round(std, 4), "window_samples": n},
    )


def _pc_anomaly(state: DetectorState, snap: ChainSnapshot) -> Anomaly | None:
    ratio = _put_call_volume_ratio(snap)
    if ratio is None:
        return None
    z = state.pc_ratio.zscore(ratio)
    mean, std, n = state.pc_ratio.stats()
    state.pc_ratio.push(ratio)
    if z is None or abs(z) < PC_SHIFT_Z:
        return None

    side = "put-heavy" if z > 0 else "call-heavy"
    factors = _confidence(z, PC_SHIFT_Z, n, snap.regime)
    return Anomaly(
        id=deterministic_id(snap.symbol, snap.ts, "pc_ratio_shift"),
        ts=snap.ts,
        symbol=snap.symbol,
        kind="pc_ratio_shift",
        headline=f"Put/Call ratio {ratio:.2f} — {side}, {z:+.1f}σ vs {mean:.2f}",
        z_score=round(z, 2),
        observed=round(ratio, 3),
        baseline_mean=round(mean, 3),
        baseline_std=round(std, 3),
        confidence=_confidence_score(factors),
        factors=factors,
        context={"pc_ratio": round(ratio, 3), "baseline_mean": round(mean, 3),
                 "baseline_std": round(std, 3), "window_samples": n,
                 "direction": side},
    )


def _vol_oi_anomaly(state: DetectorState, snap: ChainSnapshot) -> Anomaly | None:
    ratio = _vol_oi_ratio(snap)
    z = state.vol_oi.zscore(ratio)
    mean, std, n = state.vol_oi.stats()
    state.vol_oi.push(ratio)
    if z is None or abs(z) < VOL_OI_Z:
        return None
    factors = _confidence(z, VOL_OI_Z, n, snap.regime)
    return Anomaly(
        id=deterministic_id(snap.symbol, snap.ts, "vol_oi_divergence"),
        ts=snap.ts,
        symbol=snap.symbol,
        kind="vol_oi_divergence",
        headline=f"Vol/OI {ratio:.2f} — {z:+.1f}σ vs {mean:.2f} baseline",
        z_score=round(z, 2),
        observed=round(ratio, 3),
        baseline_mean=round(mean, 3),
        baseline_std=round(std, 3),
        confidence=_confidence_score(factors),
        factors=factors,
        context={"vol_oi": round(ratio, 3), "baseline_mean": round(mean, 3),
                 "baseline_std": round(std, 3), "window_samples": n},
    )


# --------------------------------------------------------------------------- #
# Public: one call per snapshot
# --------------------------------------------------------------------------- #
def evaluate(state: DetectorState, snap: ChainSnapshot) -> list[Anomaly]:
    """Score every detector against a snapshot; return only the ones that fired.

    Dedupes on the deterministic ID so the same anomaly can't be re-emitted if
    the caller retries with the same (symbol, ts, kind).
    """
    out: list[Anomaly] = []
    for fn in (_iv_anomaly, _pc_anomaly, _vol_oi_anomaly):
        a = fn(state, snap)
        if a is not None and a.id not in state.fired_ids:
            state.fired_ids.add(a.id)
            out.append(a)
    return out
