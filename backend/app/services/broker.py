# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Simulation clock + fan-out broker.

One :class:`SimulationClock` drives the :class:`MarketSimulator` forward at a
user-controlled rate ("wall-clock seconds per simulated minute"). Every tick,
it publishes the resulting snapshot to every subscribed asyncio.Queue.

The broker is deliberately in-process — no Kafka, no Redis — because the app
is single-node and the queue depth stays tiny (one snapshot per tick, dropped
into a bounded queue with backpressure). If we ever multi-node this, the same
subscribe API can front a Redis pub/sub without touching consumers.
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator

from ..models import ChainSnapshot
from .simulator import MarketSimulator, Regime

log = logging.getLogger(__name__)


class SimulationClock:
    """Drives :class:`MarketSimulator` on a timer and publishes to subscribers.

    Only one clock runs per process — the app instantiates it at startup and
    keeps it running for the session's lifetime.
    """

    # Bounded queues: a stalled consumer gets its oldest snapshot silently
    # dropped, rather than growing memory unbounded. The dashboard is
    # visualization-only, so dropping a stale tick is always the right call.
    QUEUE_MAXSIZE = 32

    def __init__(self, sim: MarketSimulator, tick_seconds: float = 1.0) -> None:
        self.sim = sim
        self.tick_seconds = tick_seconds
        self._subs: set[asyncio.Queue[ChainSnapshot]] = set()
        self._task: asyncio.Task | None = None
        self._paused = False

    # ---- lifecycle ---------------------------------------------------------

    async def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run(), name="poption-clock")

    async def stop(self) -> None:
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    def pause(self) -> None:
        self._paused = True

    def resume(self) -> None:
        self._paused = False

    def set_tick_seconds(self, seconds: float) -> None:
        """Change the wall-clock rate. Values <0.05 get clamped so we don't
        DoS the event loop."""
        self.tick_seconds = max(0.05, min(10.0, seconds))

    def set_regime(self, regime: Regime) -> None:
        self.sim.set_regime(regime)

    def plant_put_bias(self, bias: float) -> None:
        """Push a one-tick put-flow bias — the mechanism replay scenarios use."""
        self.sim.state.put_bias_extra = bias

    # ---- pub/sub -----------------------------------------------------------

    def subscribe(self) -> asyncio.Queue[ChainSnapshot]:
        q: asyncio.Queue[ChainSnapshot] = asyncio.Queue(maxsize=self.QUEUE_MAXSIZE)
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[ChainSnapshot]) -> None:
        self._subs.discard(q)

    async def _run(self) -> None:
        while True:
            await asyncio.sleep(self.tick_seconds)
            if self._paused:
                continue
            snap = self.sim.tick()
            for q in list(self._subs):
                if q.full():
                    # Drop the oldest so the newest can go in — visualization
                    # cares about "latest", not "every".
                    try:
                        _ = q.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                try:
                    q.put_nowait(snap)
                except asyncio.QueueFull:
                    # Racy edge; skip and let the next tick catch up.
                    log.debug("dropped snapshot for full queue")


async def iter_queue(q: asyncio.Queue[ChainSnapshot]) -> AsyncIterator[ChainSnapshot]:
    """Convenience: consume a subscribed queue as an async iterator."""
    while True:
        yield await q.get()
