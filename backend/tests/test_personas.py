# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Persona-trade corpus tests — structural completeness + no-advice guarantee.

Every (persona × anomaly kind) must be present with the full field set, and
the entire copy blob is walked by the same FORBIDDEN regex used by the
forensics grounding check. If a copy edit drifts into second-person
imperatives ("you should"), advice language ("we recommend"), or absolute
predictions ("will rise"), CI fails.
"""

from __future__ import annotations

from app.services import personas as personas_service
from app.services.forensics import FORBIDDEN


REQUIRED_PERSONAS = {"market_maker", "directional_trader", "vol_trader"}
REQUIRED_KINDS = {"iv_spike", "pc_ratio_shift", "vol_oi_divergence"}
REQUIRED_FIELDS = {
    "view", "structure", "example_position", "max_risk",
    "typical_horizon", "rationale",
}


def test_every_persona_metadata_present():
    ps = personas_service.list_personas()
    assert set(ps) == REQUIRED_PERSONAS
    for pkey, meta in ps.items():
        assert "title" in meta and meta["title"].strip(), f"{pkey} missing title"
        assert "philosophy" in meta and meta["philosophy"].strip(), (
            f"{pkey} missing philosophy"
        )


def test_every_kind_covers_every_persona():
    for kind in REQUIRED_KINDS:
        trades = personas_service.trades_for_kind(kind)
        assert trades is not None, f"no trades for kind {kind!r}"
        assert set(trades) == REQUIRED_PERSONAS, (
            f"kind {kind!r} missing persona(s): {REQUIRED_PERSONAS - set(trades)}"
        )


def test_every_trade_has_the_full_field_set():
    """Missing a field wouldn't be caught by the API contract — the corpus is
    just a JSON blob — so we assert it here."""
    for kind in REQUIRED_KINDS:
        trades = personas_service.trades_for_kind(kind)
        assert trades is not None
        for persona, t in trades.items():
            missing = REQUIRED_FIELDS - set(t)
            assert not missing, f"{kind}/{persona} missing: {missing}"
            for field in REQUIRED_FIELDS:
                assert t[field].strip(), f"{kind}/{persona}.{field} is blank"


def test_persona_copy_contains_no_advice_phrasing():
    """The whole corpus, walked by the same regex the forensics grounding
    check uses. Any drift into 'you should' style phrasing fails the build."""
    text = personas_service.all_text_for_copy_check()
    hits = [m.group(0) for m in FORBIDDEN.finditer(text)]
    assert not hits, f"advice-like language in personas corpus: {hits}"


def test_persona_bundle_shape_matches_the_frontend_contract():
    """The /personas/{id} endpoint returns this shape — asserting it here
    means a corpus edit that breaks the API also breaks a fast test, not a
    slow e2e."""
    bundle = personas_service.persona_bundle("iv_spike")
    assert bundle is not None
    assert bundle["kind"] == "iv_spike"
    assert isinstance(bundle["personas"], list)
    assert len(bundle["personas"]) == 3
    for row in bundle["personas"]:
        assert row["persona"] in REQUIRED_PERSONAS
        assert row["title"] and row["philosophy"]
        for field in REQUIRED_FIELDS:
            assert row[field]


def test_persona_bundle_returns_none_for_unknown_kind():
    assert personas_service.persona_bundle("not_a_kind") is None
