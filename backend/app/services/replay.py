# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Historical replay scenarios — three real events, driven by scripted
parameter overrides on the synthetic generator.

The scenarios don't reproduce actual OPRA data (we can't license it). They
reproduce the *shape* of the flow: what changed in IV, put/call, and volume/OI
during the event. The viewer watches the same detector fire on the same
pattern they'd see in the real market.

Each scenario is a small ordered list of :class:`Step`. Every step names how
many ticks to run and what to nudge — the regime, the spot, the put bias,
etc. The runner pushes those onto the simulator and lets the clock do the
rest.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from .simulator import Regime


@dataclass
class Step:
    """One scripted change plus the tick count to hold it for."""

    ticks: int
    regime: Regime | None = None
    put_bias: float = 0.0
    volume_bias: float | None = None
    spot_shock_pct: float = 0.0  # instant multiplicative kick (once, on entry)
    label: str = ""


@dataclass
class Scenario:
    """A named replay scenario: metadata + the ordered steps."""

    key: str
    title: str
    date: str
    summary: str
    steps: list[Step] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# The three scenarios. Numbers are stylized approximations, not real data.
# --------------------------------------------------------------------------- #

COVID_CRASH = Scenario(
    key="covid",
    title="COVID Crash",
    date="2020-03",
    summary=(
        "Late-Feb through mid-March 2020: VIX ripped from ~14 to >80. Put "
        "demand overwhelmed calls, IV surface exploded and re-steepened, "
        "volume-to-OI blew out as new hedges opened faster than existing "
        "positions could unwind."
    ),
    steps=[
        Step(ticks=25, regime="normal", label="pre-event"),
        Step(ticks=8, regime="normal", put_bias=0.15, label="creeping unease"),
        Step(ticks=6, regime="stressed", put_bias=0.30, spot_shock_pct=-4.0, label="first leg down"),
        Step(ticks=6, regime="stressed", put_bias=0.45, spot_shock_pct=-6.0, label="capitulation"),
        Step(ticks=10, regime="stressed", put_bias=0.20, label="stabilizing"),
    ],
)


GME_SQUEEZE = Scenario(
    key="gme",
    title="GameStop Squeeze",
    date="2021-01",
    summary=(
        "Late-Jan 2021: coordinated retail call-buying forced a short squeeze. "
        "Call volume dwarfed puts (P/C ratio inverted), OTM call IV rocketed, "
        "and volume/OI ratios on short-dated calls hit multi-sigma extremes as "
        "brand-new positioning opened faster than existing OI."
    ),
    steps=[
        Step(ticks=25, regime="normal", label="pre-event"),
        Step(ticks=4, regime="normal", put_bias=-0.20, label="calls warming"),
        Step(ticks=5, regime="stressed", put_bias=-0.50, spot_shock_pct=+8.0, label="squeeze ignites"),
        Step(ticks=6, regime="stressed", put_bias=-0.65, spot_shock_pct=+12.0, label="peak frenzy"),
        Step(ticks=10, regime="stressed", put_bias=-0.30, label="stabilizing higher"),
    ],
)


SVB_COLLAPSE = Scenario(
    key="svb",
    title="SVB Collapse",
    date="2023-03",
    summary=(
        "March 10 2023: a regional-bank funding crisis snowballed into a "
        "48-hour panic. Put demand on the sector spiked, IV surface dislocated "
        "with steep skew, and the P/C ratio ran multi-sigma above baseline."
    ),
    steps=[
        Step(ticks=25, regime="normal", label="pre-event"),
        Step(ticks=6, regime="normal", put_bias=0.20, spot_shock_pct=-2.0, label="rumors circulate"),
        Step(ticks=8, regime="stressed", put_bias=0.50, spot_shock_pct=-8.0, label="deposit run"),
        Step(ticks=5, regime="stressed", put_bias=0.40, spot_shock_pct=-5.0, label="halt / seizure"),
        Step(ticks=8, regime="stressed", put_bias=0.15, label="uncertainty"),
    ],
)


SCENARIOS: dict[str, Scenario] = {
    COVID_CRASH.key: COVID_CRASH,
    GME_SQUEEZE.key: GME_SQUEEZE,
    SVB_COLLAPSE.key: SVB_COLLAPSE,
}


def get_scenario(key: str) -> Scenario | None:
    return SCENARIOS.get(key.lower())


def list_scenarios() -> list[dict]:
    """Metadata for the frontend picker — no steps in the payload."""
    return [
        {
            "key": s.key,
            "title": s.title,
            "date": s.date,
            "summary": s.summary,
            "total_ticks": sum(step.ticks for step in s.steps),
        }
        for s in SCENARIOS.values()
    ]
