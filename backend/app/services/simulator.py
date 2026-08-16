"""Regime-switching synthetic options-market generator.

A deterministic, seedable driver of spot + IV surface parameters that walks
between three regimes:

  calm     — low realized vol, tight IV, balanced put/call flow
  normal   — baseline realized vol + IV surface, typical flow
  stressed — spot drift down, IV surface pops (fatter tails, steeper skew),
             put/call ratio tilts toward puts

Every "tick" emits a full :class:`ChainSnapshot` — that's what the streaming
pipeline puts on the queue and the detector consumes. The user can nudge the
generator into a specific regime (that's how historical replay works: the
scenario files just script the regime + parameter overrides on a timeline).
"""

from __future__ import annotations

import hashlib
import math
import random
import time
from dataclasses import dataclass, field
from typing import Literal

from ..config import (
    BASE_IV,
    DEFAULT_DTES,
    DEFAULT_Q,
    DEFAULT_R,
    DEFAULT_SPOT,
    DEFAULT_SYMBOL,
    STRIKE_OFFSETS_PCT,
)
from ..models import ChainSnapshot, OptionQuote
from . import blackscholes as bs
from .ivsurface import SurfaceParams, iv_from_surface

Regime = Literal["calm", "normal", "stressed"]


# One trading day in seconds — the sim clock resolution.
SECONDS_PER_TICK = 60.0
TRADING_DAYS_PER_YEAR = 252.0


# Regime → parameter overrides. Kept explicit and small so any test can
# reference the exact numbers being applied.
REGIME_TABLE: dict[Regime, dict[str, float]] = {
    "calm": {"drift": 0.05, "vol": 0.12, "iv_bump": -0.04, "skew_mult": 0.7, "put_bias": -0.10},
    "normal": {"drift": 0.02, "vol": 0.20, "iv_bump": 0.00, "skew_mult": 1.0, "put_bias": 0.0},
    "stressed": {"drift": -0.20, "vol": 0.55, "iv_bump": 0.15, "skew_mult": 1.8, "put_bias": 0.35},
}


@dataclass
class SimulatorState:
    """Mutable state — updated in place each tick."""

    symbol: str = DEFAULT_SYMBOL
    spot: float = DEFAULT_SPOT
    regime: Regime = "normal"
    session_open_ts: float = field(default_factory=time.time)
    ticks_elapsed: int = 0
    # Volume/OI live in state so anomalies can be planted deterministically.
    volume_bias: float = 1.0    # multiplier on baseline per-strike volume draw
    put_bias_extra: float = 0.0  # additional put-side volume tilt for a single tick

    def clone(self) -> "SimulatorState":
        return SimulatorState(
            symbol=self.symbol,
            spot=self.spot,
            regime=self.regime,
            session_open_ts=self.session_open_ts,
            ticks_elapsed=self.ticks_elapsed,
            volume_bias=self.volume_bias,
            put_bias_extra=self.put_bias_extra,
        )


class MarketSimulator:
    """Drives spot and volume/OI forward each tick, then emits a chain snapshot."""

    def __init__(self, seed: int = 42, state: SimulatorState | None = None) -> None:
        self._rng = random.Random(seed)
        self.state = state or SimulatorState()

    # -- state helpers --------------------------------------------------------

    def set_regime(self, regime: Regime) -> None:
        self.state.regime = regime

    # -- one tick -------------------------------------------------------------

    def tick(self) -> ChainSnapshot:
        """Advance one minute of simulation time and return the new snapshot."""
        regime = REGIME_TABLE[self.state.regime]
        dt = SECONDS_PER_TICK / (TRADING_DAYS_PER_YEAR * 6.5 * 3600.0)  # frac of a trading year
        # Geometric Brownian step scaled to per-tick.
        drift = regime["drift"] * dt
        shock = regime["vol"] * math.sqrt(dt) * self._rng.gauss(0.0, 1.0)
        self.state.spot = max(1.0, self.state.spot * math.exp(drift + shock))
        self.state.ticks_elapsed += 1

        return self._snapshot()

    def _snapshot(self) -> ChainSnapshot:
        s = self.state.spot
        regime_key = self.state.regime
        regime = REGIME_TABLE[regime_key]

        params = SurfaceParams(
            atm_vol=BASE_IV + regime["iv_bump"],
            skew=-0.30 * regime["skew_mult"],
            smile=0.18,
            term_slope=0.05,
        )

        put_bias = regime["put_bias"] + self.state.put_bias_extra
        # One-shot bias is consumed each tick — planted anomalies don't linger.
        self.state.put_bias_extra = 0.0

        quotes: list[OptionQuote] = []
        for dte_days in DEFAULT_DTES:
            t = dte_days / 365.0
            for off_pct in STRIKE_OFFSETS_PCT:
                # Round strikes to $0.50 for readability without losing shape.
                raw_strike = s * (1.0 + off_pct / 100.0)
                strike = round(raw_strike * 2.0) / 2.0
                iv = iv_from_surface(strike, s, t, params)
                for is_call in (True, False):
                    mid = bs.price(s, strike, t, DEFAULT_R, DEFAULT_Q, iv, is_call)
                    # Half-percent bid/ask spread — deliberately wider than reality
                    # so quantized bid/ask never cross for near-worthless strikes.
                    half_spread = max(0.01, 0.005 * mid + 0.02)
                    bid = max(0.0, mid - half_spread)
                    ask = mid + half_spread
                    g = bs.greeks(s, strike, t, DEFAULT_R, DEFAULT_Q, iv, is_call)

                    base_vol = _base_volume(off_pct, dte_days, self._rng)
                    vol_scale = self.state.volume_bias
                    if is_call:
                        vol_scale *= 1.0 - min(0.7, max(-0.7, put_bias))
                    else:
                        vol_scale *= 1.0 + min(0.7, max(-0.7, put_bias))
                    volume = max(0, int(round(base_vol * vol_scale)))
                    oi = int(round(base_vol * 5.0))

                    quotes.append(
                        OptionQuote(
                            strike=strike,
                            dte_days=dte_days,
                            type="call" if is_call else "put",
                            bid=round(bid, 2),
                            ask=round(ask, 2),
                            mid=round(mid, 2),
                            iv=round(iv, 4),
                            delta=round(g.delta, 4),
                            gamma=round(g.gamma, 6),
                            vega=round(g.vega, 4),
                            theta=round(g.theta, 4),
                            volume=volume,
                            open_interest=oi,
                        )
                    )

        ts = self.state.session_open_ts + self.state.ticks_elapsed * SECONDS_PER_TICK
        return ChainSnapshot(
            symbol=self.state.symbol,
            ts=ts,
            spot=round(s, 2),
            regime=regime_key,
            quotes=quotes,
        )


def _base_volume(offset_pct: float, dte_days: int, rng: random.Random) -> float:
    """Volume that peaks at ATM and near expiry — the shape real chains have."""
    strike_factor = math.exp(-((offset_pct / 8.0) ** 2))     # gaussian in offset
    dte_factor = math.exp(-((dte_days - 14) / 40.0) ** 2)    # front-month bias
    base = 500.0 * strike_factor * dte_factor
    noise = rng.uniform(0.7, 1.3)
    return base * noise


def deterministic_id(*parts: object) -> str:
    """Stable ID for anomaly deduplication — same inputs, same hash."""
    key = "|".join(str(p) for p in parts).encode("utf-8")
    return hashlib.sha1(key).hexdigest()[:12]
