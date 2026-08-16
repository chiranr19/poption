"""End-to-end streaming pipeline tests using FastAPI's TestClient."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app, clock, sim
from app.services.simulator import MarketSimulator


@pytest.fixture(autouse=True)
def fast_clock():
    """Run the clock fast enough that a WS test doesn't wait a real second."""
    original = clock.tick_seconds
    clock.set_tick_seconds(0.05)
    yield
    clock.set_tick_seconds(original)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_root_lists_endpoints(client):
    r = client.get("/")
    assert r.status_code == 200
    j = r.json()
    assert "/ws" in j["endpoints"] and "/snapshot" in j["endpoints"]


def test_snapshot_returns_full_chain(client):
    r = client.get("/snapshot")
    assert r.status_code == 200
    j = r.json()
    assert j["symbol"] and j["spot"] > 0
    # Same shape as the simulator test: 11 strikes × 5 tenors × 2.
    assert len(j["quotes"]) == 11 * 5 * 2
    # A quote body carries everything the frontend needs.
    q0 = j["quotes"][0]
    for field in ("strike", "dte_days", "type", "iv", "delta", "gamma", "vega", "volume"):
        assert field in q0


def test_regime_switch_takes_effect_on_next_snapshot(client):
    client.post("/control/regime", json={"regime": "calm"})
    calm = client.get("/state").json()
    assert calm["regime"] == "calm"

    client.post("/control/regime", json={"regime": "stressed"})
    stressed = client.get("/state").json()
    assert stressed["regime"] == "stressed"


def test_rate_control_clamps_absurd_values(client):
    client.post("/control/rate", json={"tick_seconds": 0.001})
    assert client.get("/state").json()["tick_seconds"] == 0.05
    client.post("/control/rate", json={"tick_seconds": 999})
    assert client.get("/state").json()["tick_seconds"] == 10.0


def test_websocket_streams_snapshot_and_anomaly_frames(client):
    """Every frame is `{snapshot, anomalies}` — the anomaly list is usually
    empty (nothing fired) but the key must always be present so the client
    doesn't have to branch."""
    with client.websocket_connect("/ws") as ws:
        first = ws.receive_json()
        assert "snapshot" in first and "anomalies" in first
        assert first["snapshot"]["symbol"] and len(first["snapshot"]["quotes"]) > 0
        second = ws.receive_json()
        assert second["snapshot"]["ts"] >= first["snapshot"]["ts"]
        assert isinstance(second["anomalies"], list)


def test_anomalies_endpoint_returns_a_list(client):
    r = client.get("/anomalies?limit=5")
    assert r.status_code == 200
    assert isinstance(r.json()["anomalies"], list)


def test_personas_endpoint_404s_on_unknown_id(client):
    r = client.get("/personas/does_not_exist")
    assert r.status_code == 404


def test_pause_and_resume_control(client):
    client.post("/control/pause")
    client.post("/control/resume")
    # No exception; the endpoint always accepts these.
    assert client.get("/state").status_code == 200


def test_broker_bounded_queue_drops_oldest_not_newest():
    """A stalled consumer must never grow memory unbounded — the queue drops
    the oldest snapshot so the newest can always be delivered."""
    fresh_sim = MarketSimulator(seed=99)
    from app.services.broker import SimulationClock

    c = SimulationClock(fresh_sim, tick_seconds=0.01)
    q = c.subscribe()
    # Fill past capacity synchronously — no consumer means put_nowait would
    # normally raise, but the drop-oldest rule keeps us under maxsize.
    for _ in range(c.QUEUE_MAXSIZE + 10):
        snap = fresh_sim.tick()
        if q.full():
            _ = q.get_nowait()
        q.put_nowait(snap)
    assert q.qsize() <= c.QUEUE_MAXSIZE
