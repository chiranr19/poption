# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Simulator + IV surface tests — determinism, shape, regime effects."""

from __future__ import annotations

import pytest

from app.services.ivsurface import SurfaceParams, iv_from_surface
from app.services.simulator import DEFAULT_DTES, MarketSimulator


def test_iv_surface_has_equity_skew():
    """OTM puts (low K) should have higher IV than OTM calls (high K) at same tenor
    when skew is negative — the empirical shape after 1987."""
    p = SurfaceParams(atm_vol=0.22, skew=-0.30, smile=0.18, term_slope=0.05)
    otm_put = iv_from_surface(strike=80, spot=100, dte_years=30 / 365, params=p)
    atm = iv_from_surface(strike=100, spot=100, dte_years=30 / 365, params=p)
    otm_call = iv_from_surface(strike=120, spot=100, dte_years=30 / 365, params=p)
    assert otm_put > atm
    assert otm_put > otm_call


def test_iv_surface_has_smile():
    """Both wings above ATM when smile > 0."""
    p = SurfaceParams(atm_vol=0.22, skew=0.0, smile=0.5, term_slope=0.0)
    atm = iv_from_surface(100, 100, 30 / 365, p)
    otm_put = iv_from_surface(80, 100, 30 / 365, p)
    otm_call = iv_from_surface(120, 100, 30 / 365, p)
    assert otm_put > atm
    assert otm_call > atm


def test_iv_surface_clipped_to_positive():
    """Even extreme skew shouldn't produce zero/negative vols."""
    p = SurfaceParams(atm_vol=0.22, skew=-5.0, smile=0.0, term_slope=0.0)
    iv = iv_from_surface(50, 100, 30 / 365, p)
    assert iv > 0


# --------------------------------------------------------------------------- #
# Simulator determinism + shape
# --------------------------------------------------------------------------- #


def test_simulator_is_deterministic_given_a_seed():
    a = MarketSimulator(seed=7)
    b = MarketSimulator(seed=7)
    snaps_a = [a.tick() for _ in range(50)]
    snaps_b = [b.tick() for _ in range(50)]
    assert [s.spot for s in snaps_a] == [s.spot for s in snaps_b]
    # And the full chain: each quote's mid must match tick-for-tick.
    for sa, sb in zip(snaps_a, snaps_b):
        assert [q.mid for q in sa.quotes] == [q.mid for q in sb.quotes]


def test_snapshot_chain_shape():
    sim = MarketSimulator(seed=1)
    snap = sim.tick()
    # 11 strikes × 5 tenors × 2 (call/put)
    assert len(snap.quotes) == 11 * len(DEFAULT_DTES) * 2
    # Sanity: every quote has valid bid ≤ mid ≤ ask.
    for q in snap.quotes:
        assert 0.0 <= q.bid <= q.mid <= q.ask


def test_stressed_regime_bumps_atm_iv_above_calm():
    """Same seed, same tick count — stressed regime must show higher ATM IV
    than calm. This is the mechanism the detector's regime factor will read."""
    calm = MarketSimulator(seed=42)
    calm.set_regime("calm")
    stressed = MarketSimulator(seed=42)
    stressed.set_regime("stressed")

    # Take one tick, then look at ATM 30d call IV in each.
    snap_c = calm.tick()
    snap_s = stressed.tick()

    def atm_iv(snap):
        atm = [q for q in snap.quotes if q.type == "call" and q.dte_days == 30]
        return min(atm, key=lambda q: abs(q.strike - snap.spot)).iv

    assert atm_iv(snap_s) > atm_iv(snap_c)


def test_stressed_regime_tilts_flow_toward_puts():
    """Stressed regime's put_bias should show more put volume than call volume
    on the ATM strip — this is what the P/C-ratio detector will fire on."""
    sim = MarketSimulator(seed=3)
    sim.set_regime("stressed")
    # Average over a few ticks to damp the per-strike noise.
    p_total = c_total = 0
    for _ in range(10):
        snap = sim.tick()
        for q in snap.quotes:
            if q.dte_days != 30:
                continue
            if q.type == "put":
                p_total += q.volume
            else:
                c_total += q.volume
    assert p_total > c_total


def test_regime_bias_is_one_shot_and_consumed():
    """put_bias_extra must be reset after the tick that uses it — otherwise a
    planted anomaly leaks into every subsequent snapshot."""
    sim = MarketSimulator(seed=5)
    sim.state.put_bias_extra = 0.5
    sim.tick()
    assert sim.state.put_bias_extra == 0.0
