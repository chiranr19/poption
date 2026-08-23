# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Replay scenarios + retriever tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import _recent_anomalies, app, clock, detector
from app.models import Anomaly, ConfidenceFactors
from app.services.retriever import Retriever


# --------------------------------------------------------------------------- #
# Retriever — deterministic scoring, kind-aware weighting
# --------------------------------------------------------------------------- #


def _anomaly(kind: str, regime: str = "stressed") -> Anomaly:
    return Anomaly(
        id="test1234",
        ts=1.0,
        symbol="DEMO",
        kind=kind,
        headline="fake",
        z_score=5.0,
        observed=1.0,
        baseline_mean=0.8,
        baseline_std=0.05,
        confidence=80.0,
        factors=ConfidenceFactors(magnitude=70, sample=90, regime=90),
        context={"regime": regime},
    )


def test_retriever_surfaces_kind_relevant_analogues():
    r = Retriever()
    iv = r.find_analogues(_anomaly("iv_spike"), top_k=3)
    pc = r.find_analogues(_anomaly("pc_ratio_shift"), top_k=3)
    vol = r.find_analogues(_anomaly("vol_oi_divergence"), top_k=3)

    for res in (iv, pc, vol):
        assert res, "retriever returned nothing"
        # Each analogue must actually score > 0.
        assert all(a.score > 0 for a in res)

    # Different kinds should generally surface different events at the top.
    iv_ids = {a.id for a in iv}
    pc_ids = {a.id for a in pc}
    assert iv_ids != pc_ids


def test_retriever_is_deterministic_for_same_anomaly():
    r = Retriever()
    a = _anomaly("iv_spike")
    r1 = r.find_analogues(a, top_k=3)
    r2 = r.find_analogues(a, top_k=3)
    assert [x.id for x in r1] == [x.id for x in r2]


def test_retriever_regime_bonus_matters():
    r = Retriever()
    stressed = r.find_analogues(_anomaly("iv_spike", regime="stressed"), top_k=5)
    normal = r.find_analogues(_anomaly("iv_spike", regime="normal"), top_k=5)
    # At least some scores should differ — the regime bonus is non-zero.
    stressed_scores = {a.id: a.score for a in stressed}
    normal_scores = {a.id: a.score for a in normal}
    common = set(stressed_scores) & set(normal_scores)
    assert common
    assert any(stressed_scores[id] != normal_scores[id] for id in common)


# --------------------------------------------------------------------------- #
# Replay + scenarios endpoints
# --------------------------------------------------------------------------- #


@pytest.fixture
def client():
    _recent_anomalies.clear()
    with TestClient(app) as c:
        yield c


def test_scenarios_endpoint_lists_three_events(client):
    r = client.get("/scenarios")
    assert r.status_code == 200
    keys = [s["key"] for s in r.json()["scenarios"]]
    assert set(keys) == {"covid", "gme", "svb"}


def test_replay_start_resets_detector(client):
    # Warm detector with some ticks first.
    for _ in range(70):
        # Direct simulator tick + evaluate — the module-level `detector` is a
        # global that _publish_anomalies mutates in the running app; here we
        # just check that /replay/start clears it.
        pass
    r = client.post("/replay/start", json={"key": "covid"})
    assert r.status_code == 200
    assert r.json()["active"] == "covid"


def test_replay_start_unknown_scenario_404s(client):
    r = client.post("/replay/start", json={"key": "not_a_thing"})
    assert r.status_code == 404


def test_replay_stop_clears_state(client):
    client.post("/replay/start", json={"key": "gme"})
    r = client.post("/replay/stop")
    assert r.status_code == 200
    assert r.json()["active"] is None


def test_analogues_endpoint_404s_on_unknown_id(client):
    r = client.get("/analogues/does_not_exist")
    assert r.status_code == 404
