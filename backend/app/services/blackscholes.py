# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Black-Scholes option pricing + analytical Greeks.

Pure functions over floats/arrays — no state, no I/O — so the tests can
compare directly to hand-computed reference values. NumPy is used only for its
scalar-safe erf/log/exp so this file also vectorizes cleanly if we ever need
it to.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


SQRT_2 = math.sqrt(2.0)
SQRT_2PI = math.sqrt(2.0 * math.pi)


def _cdf(x: float) -> float:
    """Standard normal CDF via erf — accurate to ~7 decimals in stdlib."""
    return 0.5 * (1.0 + math.erf(x / SQRT_2))


def _pdf(x: float) -> float:
    return math.exp(-0.5 * x * x) / SQRT_2PI


def _d1_d2(s: float, k: float, t: float, r: float, q: float, sigma: float) -> tuple[float, float]:
    if t <= 0 or sigma <= 0:
        raise ValueError("t and sigma must be positive to compute d1/d2")
    vol_t = sigma * math.sqrt(t)
    d1 = (math.log(s / k) + (r - q + 0.5 * sigma * sigma) * t) / vol_t
    d2 = d1 - vol_t
    return d1, d2


@dataclass(frozen=True)
class Greeks:
    """Standard first-order Greeks. All in the natural per-1 units:

    - delta: dPrice/dSpot (per $1 move in S)
    - gamma: d²Price/dSpot² (per $1²)
    - vega:  dPrice/dSigma (per 1.0 change in vol — i.e. 100 vol-points; scale
             by 0.01 for per-vol-point if you want the trader convention)
    - theta: dPrice/dT (per year of calendar time)
    - rho:   dPrice/dR (per 1.0 change in rate)
    """

    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float


def price(
    s: float,
    k: float,
    t: float,
    r: float,
    q: float,
    sigma: float,
    is_call: bool = True,
) -> float:
    """Black-Scholes-Merton price for a European call or put on a
    dividend-paying underlying.

    Degenerate at-expiry / zero-vol case is handled analytically so the pricing
    loop doesn't have to special-case near-expiration options.
    """
    if t <= 0 or sigma <= 0:
        # No time value left — return the intrinsic.
        intrinsic = max(0.0, s - k) if is_call else max(0.0, k - s)
        return intrinsic

    d1, d2 = _d1_d2(s, k, t, r, q, sigma)
    disc_r = math.exp(-r * t)
    disc_q = math.exp(-q * t)
    if is_call:
        return s * disc_q * _cdf(d1) - k * disc_r * _cdf(d2)
    return k * disc_r * _cdf(-d2) - s * disc_q * _cdf(-d1)


def greeks(
    s: float,
    k: float,
    t: float,
    r: float,
    q: float,
    sigma: float,
    is_call: bool = True,
) -> Greeks:
    """Analytical first-order Greeks matching :func:`price`."""
    if t <= 0 or sigma <= 0:
        # Same convention as price: no derivatives past expiry.
        return Greeks(0.0, 0.0, 0.0, 0.0, 0.0)

    d1, d2 = _d1_d2(s, k, t, r, q, sigma)
    disc_r = math.exp(-r * t)
    disc_q = math.exp(-q * t)
    n_d1 = _pdf(d1)
    sqrt_t = math.sqrt(t)

    # Delta / gamma share the same core; sign flips for puts.
    if is_call:
        delta = disc_q * _cdf(d1)
        rho = k * t * disc_r * _cdf(d2)
        theta_bs = (
            -s * disc_q * n_d1 * sigma / (2.0 * sqrt_t)
            - r * k * disc_r * _cdf(d2)
            + q * s * disc_q * _cdf(d1)
        )
    else:
        delta = disc_q * (_cdf(d1) - 1.0)
        rho = -k * t * disc_r * _cdf(-d2)
        theta_bs = (
            -s * disc_q * n_d1 * sigma / (2.0 * sqrt_t)
            + r * k * disc_r * _cdf(-d2)
            - q * s * disc_q * _cdf(-d1)
        )

    gamma = disc_q * n_d1 / (s * sigma * sqrt_t)
    vega = s * disc_q * n_d1 * sqrt_t

    return Greeks(delta=delta, gamma=gamma, vega=vega, theta=theta_bs, rho=rho)


def implied_vol(
    market_price: float,
    s: float,
    k: float,
    t: float,
    r: float,
    q: float,
    is_call: bool = True,
    tol: float = 1e-6,
    max_iter: int = 60,
) -> float | None:
    """Back out implied volatility from a market price via bisection.

    Bisection over Newton because it can't blow up on flat vega near deep OTM
    strikes — we're inverting a monotonic function on a bounded interval, and
    ~60 iterations gives >1e-6 precision without care.

    Returns None when the target price is outside the feasible range.
    """
    if t <= 0:
        return None

    # Feasibility bounds (no-arb: European price bounded by these).
    disc_r = math.exp(-r * t)
    disc_q = math.exp(-q * t)
    if is_call:
        lo_bound = max(0.0, s * disc_q - k * disc_r)
        hi_bound = s * disc_q
    else:
        lo_bound = max(0.0, k * disc_r - s * disc_q)
        hi_bound = k * disc_r
    if not (lo_bound - tol <= market_price <= hi_bound + tol):
        return None

    lo, hi = 1e-6, 5.0  # 500% vol is a fine upper cap for anything sane
    for _ in range(max_iter):
        mid = 0.5 * (lo + hi)
        p_mid = price(s, k, t, r, q, mid, is_call)
        if abs(p_mid - market_price) < tol:
            return mid
        if p_mid > market_price:
            hi = mid
        else:
            lo = mid
    return 0.5 * (lo + hi)
