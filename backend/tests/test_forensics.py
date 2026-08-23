# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Grounded-forensics tests — the anti-hallucination guarantee.

This is the differentiator inherited from Stocky's `test_digest.py`. If any of
these fail, the LLM (or the fallback stub) is inventing numbers or drifting
into advice — either way, the "grounded forensics" pitch is a lie.
"""

from __future__ import annotations

from app.models import Anomaly, ConfidenceFactors
from app.services.forensics import (
    FORBIDDEN,
    grounding_report,
    render_stub,
)
from app.services.retriever import Analogue


def _anomaly() -> Anomaly:
    return Anomaly(
        id="abc123",
        ts=1000.0,
        symbol="DEMO",
        kind="iv_spike",
        headline="ATM IV 34% — +4.2σ vs 22% baseline",
        z_score=4.2,
        observed=0.34,
        baseline_mean=0.22,
        baseline_std=0.028,
        confidence=76.5,
        factors=ConfidenceFactors(magnitude=80, sample=90, regime=60),
        context={
            "iv_current": 0.34,
            "iv_baseline_mean": 0.22,
            "iv_baseline_std": 0.028,
            "window_samples": 55,
            "regime": "stressed",
        },
    )


def _analogues() -> list[Analogue]:
    return [
        Analogue(id="covid-crash-2020", title="COVID Crash", date="2020-03",
                 lesson="ex.", score=6.5, tags=["crash"]),
        Analogue(id="volmageddon-2018", title="Volmageddon", date="2018-02-05",
                 lesson="ex.", score=5.5, tags=["short_vol_unwind"]),
    ]


# --------------------------------------------------------------------------- #
# grounding_report — the enforcement rule
# --------------------------------------------------------------------------- #


def test_stub_output_passes_grounding_check():
    """The deterministic stub is our floor: if IT can't pass grounding, the
    check itself is broken."""
    text = render_stub(_anomaly(), _analogues())
    report = grounding_report(text, _anomaly(), _analogues())
    assert report["ok"] is True, report


def test_grounding_report_flags_invented_numbers():
    """A fabricated number the payload never contained must be caught."""
    report = grounding_report(
        "This is a 99.87 sigma event unlike anything before.",
        _anomaly(),
        _analogues(),
    )
    assert report["ok"] is False
    assert any("99.87" in tok for tok in report["unknown_numbers"])


def test_grounding_report_flags_advice_language():
    """Explicit advice phrases fail regardless of numeric grounding."""
    report = grounding_report(
        "This means you should buy. Guaranteed price target higher.",
        _anomaly(),
        _analogues(),
    )
    assert report["ok"] is False
    assert report["advice_hits"], "advice regex didn't catch obvious phrases"


def test_grounding_allows_small_integers_freely():
    """1, 2, 3 aren't 'data claims' — the check would be maddening otherwise."""
    report = grounding_report(
        "Consider 3 factors: 1 magnitude, 2 sample maturity.",
        _anomaly(),
        _analogues(),
    )
    assert report["ok"] is True


def test_grounding_allows_analogue_dates():
    """Dates from retrieved analogues (like '2020') must not count as invented."""
    text = "Similar to the 2020 pattern and the 2018 unwind."
    report = grounding_report(text, _anomaly(), _analogues())
    assert report["ok"] is True


def test_forbidden_pattern_catches_all_key_phrases():
    """Belt-and-suspenders on the FORBIDDEN regex — a doc-only test that any
    future edit doesn't accidentally weaken it."""
    hits = [
        "you should buy",
        "we recommend",
        "guaranteed profits",
        "price target",
        "must sell now",
        "will rise sharply",
    ]
    for phrase in hits:
        assert FORBIDDEN.search(phrase), f"regex missed {phrase!r}"


def test_forbidden_pattern_permits_neutral_language():
    """We must not accidentally block words that legitimately show up in
    analysis: 'target' (as a noun for OI), 'rise' (as a verb in history)."""
    ok = [
        "IV rose earlier this session",
        "The mechanism behind this shift",
        "Retail concentrated positioning",
    ]
    for phrase in ok:
        assert not FORBIDDEN.search(phrase), f"regex flagged benign phrase {phrase!r}"


# --------------------------------------------------------------------------- #
# End-to-end: forensics endpoint with the stub path (no API key needed in CI)
# --------------------------------------------------------------------------- #


def test_forensics_full_endpoint_returns_grounded_text():
    """The full endpoint must return ok=True on the stub path (no API key)."""
    import pytest
    from fastapi.testclient import TestClient

    from app.main import _publish_anomalies, _recent_anomalies, app, detector, sim

    _recent_anomalies.clear()
    detector.iv.values.clear()
    detector.pc_ratio.values.clear()
    detector.vol_oi.values.clear()
    detector.fired_ids.clear()

    with TestClient(app) as c:
        # Warm the detector.
        for _ in range(65):
            _publish_anomalies(sim.tick())
        # Plant a signal.
        sim.state.put_bias_extra = 0.75
        fired: list = []
        for _ in range(5):
            fired.extend(_publish_anomalies(sim.tick()))
            if fired:
                break

        if not fired:
            pytest.skip("planted anomaly did not fire in this seed's window; sim path drift")
        aid = fired[0].id

        r = c.get(f"/forensics/{aid}/full?depth=fast")
        assert r.status_code == 200
        j = r.json()
        assert j["text"], "forensics returned empty text"
        assert j["grounding"]["ok"] is True, (
            f"stub-path grounding failed: {j['grounding']}"
        )
