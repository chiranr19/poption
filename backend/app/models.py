# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Pydantic models — the API's contract with the frontend.

These mirror the TypeScript types in ``frontend/src/lib/types.ts`` — keep the
two in sync when changing shapes.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class OptionQuote(BaseModel):
    """One row of an options chain snapshot."""

    strike: float
    dte_days: int = Field(description="Days to expiry.")
    type: Literal["call", "put"]
    bid: float
    ask: float
    mid: float
    iv: float = Field(description="Implied vol as a decimal, e.g. 0.28 = 28%.")
    delta: float
    gamma: float
    vega: float
    theta: float
    volume: int
    open_interest: int


class ChainSnapshot(BaseModel):
    """A full options-chain snapshot at one point in the simulation clock."""

    symbol: str
    ts: float = Field(description="Simulation timestamp (seconds since epoch of session open).")
    spot: float
    regime: Literal["calm", "normal", "stressed"]
    quotes: list[OptionQuote]


class ConfidenceFactors(BaseModel):
    """Named factors behind the 0-100 confidence — never show a bare score."""

    magnitude: float = Field(description="0-100. How far past the trigger threshold.")
    sample: float = Field(description="0-100. Rolling-window maturity.")
    regime: float = Field(description="0-100. Regime-aware discount (stressed = higher noise).")


class Anomaly(BaseModel):
    """One fired anomaly, with the numbers a forensic explanation must cite."""

    id: str = Field(description="Deterministic ID from (symbol, ts, kind) — dedupe safe.")
    ts: float
    symbol: str
    kind: Literal["iv_spike", "pc_ratio_shift", "vol_oi_divergence"]
    headline: str = Field(description="One-line summary — the caption on the chart.")
    z_score: float
    observed: float
    baseline_mean: float
    baseline_std: float
    confidence: float = Field(ge=0, le=100)
    factors: ConfidenceFactors
    context: dict = Field(
        default_factory=dict,
        description="Kind-specific numbers the LLM may cite — every value here is trusted.",
    )
