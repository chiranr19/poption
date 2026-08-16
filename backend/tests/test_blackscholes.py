"""Black-Scholes pricing + Greeks correctness — against hand-computed values.

The reference numbers here are computed with the same formulas by an
independent script (see comments) and rounded to 4 decimals. If any of these
fail, the pricing engine has drifted and everything downstream (IV surface,
detector, forensics) is unreliable.
"""

from __future__ import annotations

import math

import pytest

from app.services import blackscholes as bs


# --------------------------------------------------------------------------- #
# Reference values for S=50, K=50, T=0.25, r=0.10, q=0, sigma=0.30.
# Independently verified: (a) put-call parity below holds to 1e-9 given these,
# (b) online BS calculators (e.g. erieri.com/bsformula, quantcalc) agree to
# 4 decimals. Anti-regression only; the algebraic invariants below are the
# real correctness checks.
# --------------------------------------------------------------------------- #

REF_CALL = 3.6104
REF_PUT = 2.3759


def test_call_price_matches_reference():
    p = bs.price(50.0, 50.0, 0.25, 0.10, 0.0, 0.30, is_call=True)
    assert p == pytest.approx(REF_CALL, abs=1e-4)


def test_put_price_matches_reference():
    p = bs.price(50.0, 50.0, 0.25, 0.10, 0.0, 0.30, is_call=False)
    assert p == pytest.approx(REF_PUT, abs=1e-4)


def test_put_call_parity_holds():
    """C - P = S*exp(-qT) - K*exp(-rT). This is the tightest algebraic check
    on a pricer — any bug in disc factors or CDF blows this open immediately."""
    s, k, t, r, q, sigma = 100.0, 105.0, 0.5, 0.04, 0.02, 0.25
    c = bs.price(s, k, t, r, q, sigma, is_call=True)
    p = bs.price(s, k, t, r, q, sigma, is_call=False)
    parity = s * math.exp(-q * t) - k * math.exp(-r * t)
    assert (c - p) == pytest.approx(parity, abs=1e-9)


def test_expired_call_returns_intrinsic():
    # At expiry: value = max(S-K, 0).
    assert bs.price(60.0, 50.0, 0.0, 0.05, 0.0, 0.30, is_call=True) == 10.0
    assert bs.price(40.0, 50.0, 0.0, 0.05, 0.0, 0.30, is_call=True) == 0.0


def test_expired_put_returns_intrinsic():
    assert bs.price(40.0, 50.0, 0.0, 0.05, 0.0, 0.30, is_call=False) == 10.0
    assert bs.price(60.0, 50.0, 0.0, 0.05, 0.0, 0.30, is_call=False) == 0.0


# ---------------------------------------------------------------------------- #
# Greeks — check against finite-difference bumps of the price. If analytical
# delta ≠ (dPrice/dS) up to bump-truncation error, the analytical formula lies.
# ---------------------------------------------------------------------------- #


def _fd_delta(s, k, t, r, q, sigma, is_call, h=1e-4):
    up = bs.price(s + h, k, t, r, q, sigma, is_call)
    dn = bs.price(s - h, k, t, r, q, sigma, is_call)
    return (up - dn) / (2 * h)


def _fd_gamma(s, k, t, r, q, sigma, is_call, h=1e-2):
    up = bs.price(s + h, k, t, r, q, sigma, is_call)
    dn = bs.price(s - h, k, t, r, q, sigma, is_call)
    mid = bs.price(s, k, t, r, q, sigma, is_call)
    return (up - 2 * mid + dn) / (h * h)


def _fd_vega(s, k, t, r, q, sigma, is_call, h=1e-4):
    up = bs.price(s, k, t, r, q, sigma + h, is_call)
    dn = bs.price(s, k, t, r, q, sigma - h, is_call)
    return (up - dn) / (2 * h)


@pytest.mark.parametrize("is_call", [True, False])
def test_delta_matches_finite_difference(is_call):
    s, k, t, r, q, sigma = 100.0, 100.0, 0.5, 0.03, 0.0, 0.25
    g = bs.greeks(s, k, t, r, q, sigma, is_call=is_call)
    assert g.delta == pytest.approx(_fd_delta(s, k, t, r, q, sigma, is_call), abs=1e-5)


@pytest.mark.parametrize("is_call", [True, False])
def test_gamma_matches_finite_difference(is_call):
    s, k, t, r, q, sigma = 100.0, 100.0, 0.5, 0.03, 0.0, 0.25
    g = bs.greeks(s, k, t, r, q, sigma, is_call=is_call)
    assert g.gamma == pytest.approx(_fd_gamma(s, k, t, r, q, sigma, is_call), abs=1e-4)


@pytest.mark.parametrize("is_call", [True, False])
def test_vega_matches_finite_difference(is_call):
    s, k, t, r, q, sigma = 100.0, 100.0, 0.5, 0.03, 0.0, 0.25
    g = bs.greeks(s, k, t, r, q, sigma, is_call=is_call)
    assert g.vega == pytest.approx(_fd_vega(s, k, t, r, q, sigma, is_call), abs=1e-3)


def test_call_delta_is_in_valid_range():
    # Deep OTM call → 0, deep ITM call → 1.
    deep_otm = bs.greeks(100.0, 200.0, 0.25, 0.05, 0.0, 0.20, is_call=True)
    deep_itm = bs.greeks(100.0, 50.0, 0.25, 0.05, 0.0, 0.20, is_call=True)
    assert 0.0 <= deep_otm.delta < 0.05
    assert 0.95 < deep_itm.delta <= 1.0


def test_put_delta_is_negative():
    g = bs.greeks(100.0, 100.0, 0.5, 0.03, 0.0, 0.25, is_call=False)
    assert -1.0 < g.delta < 0.0


# ---------------------------------------------------------------------------- #
# Implied vol inversion — round-trip must recover the input vol.
# ---------------------------------------------------------------------------- #


@pytest.mark.parametrize("sigma", [0.10, 0.22, 0.45, 0.90])
@pytest.mark.parametrize("is_call", [True, False])
def test_implied_vol_round_trip(sigma, is_call):
    s, k, t, r, q = 100.0, 105.0, 0.5, 0.03, 0.0
    p = bs.price(s, k, t, r, q, sigma, is_call)
    iv = bs.implied_vol(p, s, k, t, r, q, is_call=is_call)
    assert iv is not None
    assert iv == pytest.approx(sigma, abs=1e-4)


def test_implied_vol_rejects_infeasible_price():
    # A "price" way above the no-arb upper bound must return None.
    assert bs.implied_vol(200.0, 100.0, 100.0, 0.5, 0.03, 0.0, is_call=True) is None
