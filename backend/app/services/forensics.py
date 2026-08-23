# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""LLM-powered forensic explanations for anomalies — grounded, testable.

**The differentiator, inherited from Stocky's `test_digest.py`:**
the model may only cite numbers present in the anomaly's `context` dict, plus
the numbers on the retrieved analogues. `grounding_report()` re-checks the
generated text against those inputs so a CI test can fail the build if a
number appears that we didn't supply.

The Claude API is optional:
- With `ANTHROPIC_API_KEY` set → real streamed explanation.
- Without → a deterministic stub built from the same inputs. The stub is
  itself grounded (uses only input numbers) so tests pass either way.

Model selection:
- Fast: claude-haiku-4-5-20251001 — cheap per-tick "why did this fire" blurb.
- Deep: claude-sonnet-5 — on-demand full analyst-style write-up.

Both share one prompt template, differ only in max_tokens and depth guidance.
"""

from __future__ import annotations

import logging
import re
from typing import AsyncIterator, Iterable, Literal

from ..config import settings
from ..models import Anomaly
from .retriever import Analogue

log = logging.getLogger(__name__)

Depth = Literal["fast", "deep"]


# --------------------------------------------------------------------------- #
# The "grounded vocabulary": everything the model is allowed to cite as fact.
# --------------------------------------------------------------------------- #

# Words that would turn an interpretation into financial advice.
FORBIDDEN = re.compile(
    r"\b(you should|we recommend|recommended|buy it|sell it|must buy|must sell|"
    r"guaranteed|will rise|will fall|sure thing|price target)\b",
    re.IGNORECASE,
)

# Pattern for numeric tokens that would need to be traced.
# Skips things like "50-day", "2SV", tokens containing letters.
NUMBER_RE = re.compile(r"(?<![A-Za-z-])[-+]?\d+(?:\.\d+)?%?(?![A-Za-z])")


def _allowed_numbers(anomaly: Anomaly, analogues: Iterable[Analogue]) -> set[str]:
    """The exact strings a grounded explanation may contain as numeric literals."""
    allowed: set[str] = set()

    def _add(v) -> None:
        if v is None:
            return
        if isinstance(v, (int, float)):
            # Match all the natural rounded forms the LLM might render.
            allowed.add(f"{v}")
            allowed.add(f"{v:.0f}")
            allowed.add(f"{v:.1f}")
            allowed.add(f"{v:.2f}")
            allowed.add(f"{v:.3f}")
            if abs(v) < 1:
                allowed.add(f"{v * 100:.0f}%")
                allowed.add(f"{v * 100:.1f}%")
                allowed.add(f"{v * 100:.2f}%")
            allowed.add(f"{v:+.1f}")
            allowed.add(f"{v:+.2f}")

    # From the anomaly itself.
    _add(anomaly.z_score)
    _add(anomaly.observed)
    _add(anomaly.baseline_mean)
    _add(anomaly.baseline_std)
    _add(anomaly.confidence)
    _add(anomaly.factors.magnitude)
    _add(anomaly.factors.sample)
    _add(anomaly.factors.regime)
    for v in anomaly.context.values():
        _add(v)

    # From analogues (dates and their numbers, if any).
    for an in analogues:
        for token in re.split(r"[\s,-]+", an.date or ""):
            if token.isdigit():
                allowed.add(token)

    # Small integers are always fine (they're not "data claims").
    for i in range(0, 11):
        allowed.add(str(i))

    return allowed


def grounding_report(text: str, anomaly: Anomaly, analogues: Iterable[Analogue]) -> dict:
    """Check every numeric token in the text against the allowed set.

    Returns `{'ok': bool, 'unknown_numbers': [...], 'advice_hits': [...]}`.
    The CI test asserts `ok is True` for both the stub and any live output.
    """
    allowed = _allowed_numbers(anomaly, analogues)
    unknown: list[str] = []
    for m in NUMBER_RE.finditer(text):
        tok = m.group(0)
        if tok in allowed:
            continue
        # Also allow the bare form if the % or sign was cosmetic.
        stripped = tok.lstrip("+-").rstrip("%")
        if stripped in allowed:
            continue
        unknown.append(tok)

    advice_hits = [m.group(0) for m in FORBIDDEN.finditer(text)]
    return {
        "ok": not unknown and not advice_hits,
        "unknown_numbers": unknown,
        "advice_hits": advice_hits,
    }


# --------------------------------------------------------------------------- #
# Prompt construction — deterministic given (anomaly, analogues)
# --------------------------------------------------------------------------- #

_SYSTEM_INSTRUCTIONS = """\
You are a market-forensics analyst explaining, in plain English, why a
specific anomaly fired in an options-flow detector.

Rules (enforced by an automated grounding check that will fail if violated):
- Cite ONLY numbers present in the anomaly payload or its analogues.
- Never give trading advice: no "you should", "buy", "sell", "will rise",
  "price target", or similar language.
- Describe interpretations and mechanisms, not predictions.
- Keep it tight: 3-4 short paragraphs for fast mode, 5-6 for deep mode.
"""


def _render_prompt(anomaly: Anomaly, analogues: list[Analogue], depth: Depth) -> str:
    lines: list[str] = []
    lines.append(f"# Anomaly")
    lines.append(f"- symbol: {anomaly.symbol}")
    lines.append(f"- kind: {anomaly.kind}")
    lines.append(f"- headline: {anomaly.headline}")
    lines.append(f"- z-score: {anomaly.z_score}")
    lines.append(f"- observed: {anomaly.observed}")
    lines.append(f"- baseline mean: {anomaly.baseline_mean}")
    lines.append(f"- baseline std: {anomaly.baseline_std}")
    lines.append(f"- confidence: {anomaly.confidence}")
    lines.append(
        f"- confidence factors: magnitude={anomaly.factors.magnitude}, "
        f"sample={anomaly.factors.sample}, regime={anomaly.factors.regime}"
    )
    if anomaly.context:
        lines.append("- context:")
        for k, v in anomaly.context.items():
            lines.append(f"    {k}: {v}")

    if analogues:
        lines.append("")
        lines.append("# Historical analogues")
        for a in analogues:
            lines.append(f"- {a.date} — {a.title} (score {a.score})")
            lines.append(f"  lesson: {a.lesson}")

    lines.append("")
    depth_hint = (
        "Write 3-4 short paragraphs" if depth == "fast" else "Write 5-6 paragraphs"
    )
    lines.append(
        f"{depth_hint}: (1) what the numbers literally say, (2) the mechanism "
        f"veterans read into this pattern, (3) how the analogues connect, and "
        f"(4) what would make this reading wrong."
    )
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# Rendering — stub + live
# --------------------------------------------------------------------------- #


def render_stub(anomaly: Anomaly, analogues: list[Analogue]) -> str:
    """A grounded, deterministic explanation with no API call.

    Every number it emits comes straight from the anomaly payload — the
    grounding_report() check passes on this by construction. Used as the
    fallback when ANTHROPIC_API_KEY is missing, and as a golden template.
    """
    dir_word = "above" if anomaly.z_score > 0 else "below"
    parts: list[str] = []
    parts.append(
        f"[{anomaly.kind}] {anomaly.symbol}: observed {anomaly.observed} vs "
        f"baseline mean {anomaly.baseline_mean} (std {anomaly.baseline_std}) — "
        f"{anomaly.z_score} sigma {dir_word} the recent window."
    )
    parts.append(
        f"Confidence {anomaly.confidence}, composed of magnitude "
        f"{anomaly.factors.magnitude}, sample {anomaly.factors.sample}, "
        f"regime {anomaly.factors.regime}."
    )
    if analogues:
        titles = "; ".join(f"{a.date} {a.title}" for a in analogues)
        parts.append(f"Historical analogues: {titles}.")
    parts.append(
        "This is a descriptive statistic, not a forecast — the reading would "
        "be wrong if the shift reverts within a tick or the underlying data "
        "quality is suspect."
    )
    return " ".join(parts)


async def stream_forensics(
    anomaly: Anomaly,
    analogues: list[Analogue],
    depth: Depth = "fast",
) -> AsyncIterator[str]:
    """Stream chunks of a grounded forensic explanation.

    Falls back to yielding the deterministic stub as one chunk when the
    Anthropic key isn't set or the SDK call fails.
    """
    key = settings.anthropic_api_key.strip()
    if not key:
        yield render_stub(anomaly, analogues)
        return

    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        log.warning("anthropic SDK not installed; falling back to stub")
        yield render_stub(anomaly, analogues)
        return

    client = AsyncAnthropic(api_key=key)
    model = settings.claude_fast_model if depth == "fast" else settings.claude_deep_model
    prompt = _render_prompt(anomaly, analogues, depth)
    max_tokens = 400 if depth == "fast" else 800

    try:
        async with client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            system=_SYSTEM_INSTRUCTIONS,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for text in stream.text_stream:
                yield text
    except Exception as exc:
        log.warning("Claude call failed (%s); falling back to stub", exc)
        yield render_stub(anomaly, analogues)
