"""Poption FastAPI app entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Literal

from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import __version__
from .config import settings
from .models import ChainSnapshot
from .services.broker import SimulationClock
from .services.detector import DetectorState, evaluate
from .services.forensics import stream_forensics, render_stub, grounding_report
from .services import personas as personas_service
from .services.replay import get_scenario, list_scenarios
from .services.retriever import Retriever
from .services.simulator import MarketSimulator, Regime

log = logging.getLogger("uvicorn.error")

# Module-level: instantiated once at startup, referenced by every request.
sim = MarketSimulator(seed=1337)
clock = SimulationClock(sim, tick_seconds=1.0)
detector = DetectorState()
retriever = Retriever()
# Sliding buffer of recent anomalies for the /anomalies endpoint and for the
# LLM forensics service to look up "recent flow around this fire" context.
_recent_anomalies: list = []
RECENT_ANOMALIES_MAX = 200


@asynccontextmanager
async def lifespan(_: FastAPI):
    await clock.start()
    log.info("Poption clock started (tick=%.2fs)", clock.tick_seconds)
    yield
    await clock.stop()


app = FastAPI(
    title="Poption API",
    version=__version__,
    summary="Real-time options-flow forensics — synthetic data, grounded LLM explanations.",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# When the frontend has been built into app/static (the Docker image does
# this), serve it at /_ui so a single container hosts both. Absent in dev, so
# the check keeps a fresh clone from crashing on import.
_STATIC_DIR = Path(__file__).resolve().parent / "static"
if _STATIC_DIR.is_dir():
    app.mount("/_ui", StaticFiles(directory=_STATIC_DIR, html=True), name="ui")


# --------------------------------------------------------------------------- #
# Meta
# --------------------------------------------------------------------------- #
@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": "Poption API",
        "version": __version__,
        "disclaimer": "Synthetic-data demo. Not financial advice, not licensed for real OPRA.",
        "endpoints": [
            "/snapshot", "/state", "/control/regime", "/control/rate",
            "/control/pause", "/control/resume", "/ws", "/docs",
        ],
    }


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "clock_tick_seconds": clock.tick_seconds}


# --------------------------------------------------------------------------- #
# Snapshot / state
# --------------------------------------------------------------------------- #
@app.get("/snapshot", response_model=ChainSnapshot, tags=["data"])
def snapshot() -> ChainSnapshot:
    """The current-tick chain snapshot without waiting for the WebSocket.

    Used by the frontend for its first paint before the WebSocket lands the
    first live tick.
    """
    return sim._snapshot()  # deliberate: read current state, don't advance


class SimState(BaseModel):
    symbol: str
    spot: float
    regime: str
    ticks_elapsed: int
    tick_seconds: float


@app.get("/state", response_model=SimState, tags=["data"])
def state() -> SimState:
    return SimState(
        symbol=sim.state.symbol,
        spot=sim.state.spot,
        regime=sim.state.regime,
        ticks_elapsed=sim.state.ticks_elapsed,
        tick_seconds=clock.tick_seconds,
    )


# --------------------------------------------------------------------------- #
# Control
# --------------------------------------------------------------------------- #
class RegimeBody(BaseModel):
    regime: Literal["calm", "normal", "stressed"]


class RateBody(BaseModel):
    tick_seconds: float


@app.post("/control/regime", tags=["control"])
def set_regime(body: RegimeBody) -> dict:
    clock.set_regime(body.regime)
    return {"regime": body.regime}


@app.post("/control/rate", tags=["control"])
def set_rate(body: RateBody) -> dict:
    if body.tick_seconds <= 0:
        raise HTTPException(400, "tick_seconds must be positive")
    clock.set_tick_seconds(body.tick_seconds)
    return {"tick_seconds": clock.tick_seconds}


@app.post("/control/pause", tags=["control"])
def pause() -> dict:
    clock.pause()
    return {"paused": True}


@app.post("/control/resume", tags=["control"])
def resume() -> dict:
    clock.resume()
    return {"paused": False}


# --------------------------------------------------------------------------- #
# Replay
# --------------------------------------------------------------------------- #
@app.get("/scenarios", tags=["replay"])
def scenarios() -> dict:
    """List available historical replay scenarios (metadata only)."""
    return {"scenarios": list_scenarios()}


class ReplayBody(BaseModel):
    key: str


_replay_state: dict = {"active": None, "steps": [], "step_index": 0, "ticks_in_step": 0}


@app.post("/replay/start", tags=["replay"])
def replay_start(body: ReplayBody) -> dict:
    """Load a scenario. The clock then walks its steps tick by tick."""
    scen = get_scenario(body.key)
    if scen is None:
        raise HTTPException(404, f"unknown scenario '{body.key}'")
    # Reset the detector so the pre-event calm is what the window sees.
    global detector
    detector = DetectorState()
    _recent_anomalies.clear()
    _replay_state.update(
        active=scen.key,
        steps=list(scen.steps),
        step_index=0,
        ticks_in_step=0,
    )
    clock.set_regime("normal")
    return {"active": scen.key, "total_ticks": sum(s.ticks for s in scen.steps)}


@app.post("/replay/stop", tags=["replay"])
def replay_stop() -> dict:
    _replay_state.update(active=None, steps=[], step_index=0, ticks_in_step=0)
    return {"active": None}


def _apply_replay_step_if_any() -> None:
    """Called on every WS-published tick when a replay is active."""
    if not _replay_state["active"]:
        return
    steps: list = _replay_state["steps"]
    idx = _replay_state["step_index"]
    if idx >= len(steps):
        _replay_state.update(active=None, steps=[], step_index=0, ticks_in_step=0)
        return
    step = steps[idx]
    # On entering a new step, apply the one-shot changes.
    if _replay_state["ticks_in_step"] == 0:
        if step.regime:
            clock.set_regime(step.regime)
        if step.volume_bias is not None:
            sim.state.volume_bias = step.volume_bias
        if step.spot_shock_pct:
            sim.state.spot *= 1.0 + step.spot_shock_pct / 100.0
    # Put-bias is applied each tick of the step (it's a one-shot in the sim,
    # so we re-plant every tick to keep the pressure on).
    if step.put_bias:
        sim.state.put_bias_extra = step.put_bias
    _replay_state["ticks_in_step"] += 1
    if _replay_state["ticks_in_step"] >= step.ticks:
        _replay_state["step_index"] += 1
        _replay_state["ticks_in_step"] = 0


# --------------------------------------------------------------------------- #
# Retrieval — "what historical events look like this anomaly?"
# --------------------------------------------------------------------------- #
@app.get("/personas/{anomaly_id}", tags=["learn"])
def personas(anomaly_id: str) -> dict:
    """Persona trades for the anomaly — what market makers, directional
    traders, and vol traders typically put on in response to this kind."""
    anomaly = next((a for a in _recent_anomalies if a.id == anomaly_id), None)
    if anomaly is None:
        raise HTTPException(404, f"anomaly '{anomaly_id}' not in recent buffer")
    bundle = personas_service.persona_bundle(anomaly.kind)
    if bundle is None:
        raise HTTPException(500, f"no persona corpus for kind '{anomaly.kind}'")
    return bundle


@app.get("/analogues/{anomaly_id}", tags=["data"])
def analogues(anomaly_id: str, top_k: int = 3) -> dict:
    anomaly = next((a for a in _recent_anomalies if a.id == anomaly_id), None)
    if anomaly is None:
        raise HTTPException(404, f"anomaly '{anomaly_id}' not in recent buffer")
    found = retriever.find_analogues(anomaly, top_k=top_k)
    return {"anomaly_id": anomaly_id, "analogues": [a.__dict__ for a in found]}


# --------------------------------------------------------------------------- #
# Forensics — grounded LLM explanation of a fired anomaly
# --------------------------------------------------------------------------- #
@app.get("/forensics/{anomaly_id}", tags=["forensics"])
async def forensics(anomaly_id: str, depth: str = "fast"):
    anomaly = next((a for a in _recent_anomalies if a.id == anomaly_id), None)
    if anomaly is None:
        raise HTTPException(404, f"anomaly '{anomaly_id}' not in recent buffer")
    if depth not in ("fast", "deep"):
        raise HTTPException(400, "depth must be 'fast' or 'deep'")
    found = retriever.find_analogues(anomaly, top_k=3)

    async def gen():
        async for chunk in stream_forensics(anomaly, found, depth=depth):  # type: ignore[arg-type]
            yield chunk

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")


@app.get("/forensics/{anomaly_id}/full", tags=["forensics"])
async def forensics_full(anomaly_id: str, depth: str = "fast") -> dict:
    """Non-streaming variant — collects the stream, then reports grounding.

    Handy for the frontend to check `grounding.ok` before displaying, and for
    tests to verify the guarantee end-to-end.
    """
    anomaly = next((a for a in _recent_anomalies if a.id == anomaly_id), None)
    if anomaly is None:
        raise HTTPException(404, f"anomaly '{anomaly_id}' not in recent buffer")
    if depth not in ("fast", "deep"):
        raise HTTPException(400, "depth must be 'fast' or 'deep'")
    found = retriever.find_analogues(anomaly, top_k=3)
    text_parts: list[str] = []
    async for chunk in stream_forensics(anomaly, found, depth=depth):  # type: ignore[arg-type]
        text_parts.append(chunk)
    text = "".join(text_parts)
    return {
        "anomaly_id": anomaly_id,
        "text": text,
        "analogues": [a.__dict__ for a in found],
        "grounding": grounding_report(text, anomaly, found),
    }


# --------------------------------------------------------------------------- #
# WebSocket — one snapshot per tick, JSON-serialized.
# --------------------------------------------------------------------------- #
@app.get("/anomalies", tags=["data"])
def anomalies(limit: int = 30) -> dict:
    """Recent fired anomalies, newest first. Used by the sidebar feed."""
    limit = max(1, min(RECENT_ANOMALIES_MAX, limit))
    recent = [a.model_dump(mode="json") for a in _recent_anomalies[-limit:][::-1]]
    return {"anomalies": recent}


def _publish_anomalies(snap) -> list:
    """Score the snapshot, buffer any fires, return them for the WS frame."""
    # Drive the replay one step forward if one is active.
    _apply_replay_step_if_any()

    # Carry the snapshot's regime into anomaly context so the retriever can
    # score analogues against it.
    fired = evaluate(detector, snap)
    for a in fired:
        a.context["regime"] = snap.regime
    if fired:
        _recent_anomalies.extend(fired)
        if len(_recent_anomalies) > RECENT_ANOMALIES_MAX:
            del _recent_anomalies[: len(_recent_anomalies) - RECENT_ANOMALIES_MAX]
    return fired


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    q = clock.subscribe()
    # Immediate first paint so the dashboard doesn't wait a full tick to render.
    try:
        initial = sim._snapshot()
        await ws.send_json({
            "snapshot": initial.model_dump(mode="json"),
            "anomalies": [],  # detector state may not have warmed on first paint
        })
    except (WebSocketDisconnect, RuntimeError):
        clock.unsubscribe(q)
        return

    try:
        while True:
            snap = await q.get()
            fired = _publish_anomalies(snap)
            await ws.send_json({
                "snapshot": snap.model_dump(mode="json"),
                "anomalies": [a.model_dump(mode="json") for a in fired],
            })
    except WebSocketDisconnect:
        pass
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # network hiccup — log and drop the client cleanly
        log.warning("ws send failed: %s", exc)
    finally:
        clock.unsubscribe(q)
