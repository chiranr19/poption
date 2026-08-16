"""Synthetic implied-volatility surface with smile, skew, and term structure.

Real IV surfaces have shape: OTM puts trade richer than ATM (the "skew" — the
1987 crash left a permanent mark on how the market prices tail risk), and both
wings trade richer than ATM (the "smile"). Short-dated options are more
sensitive to spot moves than long-dated ones (term structure). The generator
here bakes those in so a downstream detector sees the same shapes it would in
real OPRA data.

All pure — a random seed makes every scenario deterministic and testable.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class SurfaceParams:
    """Parameters of the parametric IV surface.

    atm_vol: at-the-money implied volatility (annualized decimal, e.g. 0.22).
    skew: negative → OTM puts richer than OTM calls (equity default).
    smile: positive → both wings richer than ATM.
    term_slope: how atm_vol grows/shrinks with sqrt(T). Positive = contango.
    """

    atm_vol: float = 0.22
    skew: float = -0.30
    smile: float = 0.18
    term_slope: float = 0.05


def iv_from_surface(
    strike: float,
    spot: float,
    dte_years: float,
    params: SurfaceParams,
) -> float:
    """Return an implied vol for one (strike, tenor) point on the parametric surface.

    Uses log-moneyness ``m = log(K/S) / sqrt(T)`` — the standard convention
    that keeps skew/smile comparable across tenors. The result is clipped to
    (0.01, 5.0) so pathological calls to price() never see zero vol.
    """
    if dte_years <= 0 or spot <= 0 or strike <= 0:
        return max(0.01, params.atm_vol)

    m = math.log(strike / spot) / math.sqrt(max(dte_years, 1e-6))
    atm = params.atm_vol + params.term_slope * math.sqrt(dte_years)
    iv = atm + params.skew * m + params.smile * m * m
    return max(0.01, min(5.0, iv))
