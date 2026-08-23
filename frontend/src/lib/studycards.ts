// ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
/**
 * Study Cards — the tag-a-persona-trade-and-watch-it-play-out layer.
 *
 * When a user hits "Watch this play out" on a persona trade, we snapshot
 * the trade's structure at that moment (persona, view, strike offset, DTE,
 * entry spot, entry IV, entry premium) into a card, persist it to
 * localStorage, and then mark-to-market it on every incoming snapshot by
 * matching the strike back into the current chain.
 *
 * The retrospective — what the user is really here for — computes when the
 * card closes (either the user hits Close now, or sim time passes the
 * expiry). Every closed card carries a deterministic lesson tagged to
 * which Greek dominated the P&L.
 *
 * Entirely client-side: no server state, no user account, no broker
 * integration. Simulator only. The chip on every card says so.
 */

import type { ChainSnapshot, OptionQuote } from "./types";

const KEY = "poption.studycards.v1";

export type PersonaKey = "market_maker" | "directional_trader" | "vol_trader";

export type TradeKind =
  | "long_call"
  | "long_put"
  | "long_call_vertical"
  | "long_put_vertical"
  | "short_iron_condor"
  | "short_strangle"
  | "long_straddle";

export interface Leg {
  /** Strike offset in % from entry spot — matched to closest available strike each tick. */
  offset_pct: number;
  type: "call" | "put";
  action: "long" | "short";
  /** DTE the leg was opened at. Fixed at entry; decays with sim time. */
  entry_dte: number;
  entry_strike: number;
  entry_mid: number;
}

export interface StudyCard {
  id: string;
  created_at: number;         // wall-clock ms since epoch
  entry_sim_ts: number;       // sim-clock ts at entry
  entry_spot: number;
  entry_iv: number | null;    // ATM IV at entry, if captured
  entry_regime: string;
  anomaly_id: string;
  anomaly_kind: string;
  persona: PersonaKey;
  persona_title: string;
  trade_kind: TradeKind;
  trade_view: string;         // one-sentence view label, e.g. "directional bearish, defined-risk"
  legs: Leg[];
  entry_debit: number;        // net premium paid (negative for credit trades)
  max_risk_note: string;      // from persona corpus
  status: "open" | "closed";
  /** Populated when closed: current or exit mark, P&L, dominant Greek, lesson. */
  outcome?: StudyCardOutcome;
}

export interface StudyCardOutcome {
  closed_at_sim_ts: number;
  exit_spot: number;
  exit_iv: number | null;
  exit_regime: string;
  exit_mid: number;
  realized_pnl: number;
  reason: "user_closed" | "expired";
  dominant_greek: "delta" | "vega" | "theta" | "gamma";
  lesson: string;
}

export interface LiveMark {
  current_mid: number;
  unrealized_pnl: number;
  days_remaining: number;
}

// --------------------------------------------------------------------------- //
// Persistence
// --------------------------------------------------------------------------- //

export function loadCards(): StudyCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StudyCard[];
  } catch {
    return [];
  }
}

export function saveCards(cards: StudyCard[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cards));
  } catch {
    /* quota exceeded — silently drop the write; the app still runs */
  }
}

export function addCard(card: StudyCard): StudyCard[] {
  const next = [card, ...loadCards()];
  saveCards(next);
  return next;
}

export function updateCard(id: string, mutator: (c: StudyCard) => StudyCard): StudyCard[] {
  const next = loadCards().map((c) => (c.id === id ? mutator(c) : c));
  saveCards(next);
  return next;
}

export function removeCard(id: string): StudyCard[] {
  const next = loadCards().filter((c) => c.id !== id);
  saveCards(next);
  return next;
}

// --------------------------------------------------------------------------- //
// Building cards from a persona trade + current snapshot
// --------------------------------------------------------------------------- //

/**
 * Extract a strike from a chain by target offset and type. Returns the
 * closest available strike since the sim's ladder is discrete.
 */
function pickLeg(
  snap: ChainSnapshot,
  offsetPct: number,
  optType: "call" | "put",
  dte: number,
): OptionQuote | null {
  const target = snap.spot * (1 + offsetPct / 100);
  const candidates = snap.quotes.filter(
    (q) => q.type === optType && q.dte_days === dte,
  );
  if (!candidates.length) return null;
  return candidates.reduce((best, q) =>
    Math.abs(q.strike - target) < Math.abs(best.strike - target) ? q : best,
  );
}

function atmIv(snap: ChainSnapshot, dte: number): number | null {
  const calls = snap.quotes.filter((q) => q.type === "call" && q.dte_days === dte);
  if (!calls.length) return null;
  const atm = calls.reduce((best, q) =>
    Math.abs(q.strike - snap.spot) < Math.abs(best.strike - snap.spot) ? q : best,
  );
  return atm.iv;
}

/**
 * Convert a persona × anomaly-kind pair into a set of legs, using the
 * current snapshot to price them. Falls back to null if the required
 * strikes aren't in the ladder (deep OTM legs on very thin scenarios).
 */
export function structureLegsForPersona(
  personaKey: PersonaKey,
  kind: string,
  snap: ChainSnapshot,
): { kind: TradeKind; view: string; legs: Leg[] } | null {
  // Match the persona corpus's example_position. Simplified so the legs
  // fit the sim's strike ladder — everything picks nearest-available.
  //
  // (persona, anomaly kind) → structure spec:
  const specs: Record<string, { kind: TradeKind; view: string; legs: Array<Omit<Leg, "entry_strike" | "entry_mid">> }> = {
    // ---- iv_spike ------------------------------------------------------
    "market_maker:iv_spike": {
      kind: "short_iron_condor",
      view: "short vega, defined risk",
      legs: [
        { offset_pct: 5, type: "call", action: "short", entry_dte: 30 },
        { offset_pct: 10, type: "call", action: "long", entry_dte: 30 },
        { offset_pct: -5, type: "put", action: "short", entry_dte: 30 },
        { offset_pct: -10, type: "put", action: "long", entry_dte: 30 },
      ],
    },
    "directional_trader:iv_spike": {
      kind: "long_put",
      view: "directional bearish, defined-risk premium",
      legs: [{ offset_pct: -5, type: "put", action: "long", entry_dte: 30 }],
    },
    "vol_trader:iv_spike": {
      kind: "short_iron_condor",
      view: "vol mean-reversion, defined tail risk",
      legs: [
        { offset_pct: 5, type: "call", action: "short", entry_dte: 30 },
        { offset_pct: 10, type: "call", action: "long", entry_dte: 30 },
        { offset_pct: -5, type: "put", action: "short", entry_dte: 30 },
        { offset_pct: -10, type: "put", action: "long", entry_dte: 30 },
      ],
    },
    // ---- pc_ratio_shift ------------------------------------------------
    "market_maker:pc_ratio_shift": {
      kind: "long_put",  // placeholder for the delta-hedge (the MM's "trade" is the hedge itself)
      view: "flow-driven hedge; not a directional bet",
      legs: [{ offset_pct: 0, type: "put", action: "long", entry_dte: 30 }],
    },
    "directional_trader:pc_ratio_shift": {
      kind: "long_put_vertical",
      view: "aligned with informed flow, defined-risk debit",
      legs: [
        { offset_pct: -5, type: "put", action: "long", entry_dte: 30 },
        { offset_pct: -10, type: "put", action: "short", entry_dte: 30 },
      ],
    },
    "vol_trader:pc_ratio_shift": {
      kind: "short_strangle",
      view: "vol overpriced given fear signal, delta-hedged",
      legs: [
        { offset_pct: 7.5, type: "call", action: "short", entry_dte: 30 },
        { offset_pct: -7.5, type: "put", action: "short", entry_dte: 30 },
      ],
    },
    // ---- vol_oi_divergence ---------------------------------------------
    "market_maker:vol_oi_divergence": {
      kind: "long_call",  // placeholder — MM's real action is defensive
      view: "defensive posture; no directional bet",
      legs: [{ offset_pct: 0, type: "call", action: "long", entry_dte: 30 }],
    },
    "directional_trader:vol_oi_divergence": {
      kind: "long_call_vertical",
      view: "follow informed flow at the exact strikes seeing new OI",
      legs: [
        { offset_pct: 2.5, type: "call", action: "long", entry_dte: 30 },
        { offset_pct: 7.5, type: "call", action: "short", entry_dte: 30 },
      ],
    },
    "vol_trader:vol_oi_divergence": {
      kind: "long_straddle",
      view: "long optionality ahead of realized-vol expansion",
      legs: [
        { offset_pct: 0, type: "call", action: "long", entry_dte: 30 },
        { offset_pct: 0, type: "put", action: "long", entry_dte: 30 },
      ],
    },
  };

  const key = `${personaKey}:${kind}`;
  const spec = specs[key];
  if (!spec) return null;

  const legs: Leg[] = [];
  for (const raw of spec.legs) {
    const q = pickLeg(snap, raw.offset_pct, raw.type, raw.entry_dte);
    if (!q) return null;
    legs.push({
      offset_pct: raw.offset_pct,
      type: raw.type,
      action: raw.action,
      entry_dte: raw.entry_dte,
      entry_strike: q.strike,
      entry_mid: q.mid,
    });
  }
  return { kind: spec.kind, view: spec.view, legs };
}

/**
 * Signed net debit for a set of legs — positive if we paid to open, negative
 * if we collected credit. Multiplied by 100 to represent one contract per leg.
 */
export function netDebit(legs: Pick<Leg, "action" | "entry_mid">[]): number {
  const per = legs.reduce(
    (sum, l) => sum + (l.action === "long" ? l.entry_mid : -l.entry_mid),
    0,
  );
  return per * 100;
}

// --------------------------------------------------------------------------- //
// Mark-to-market — runs on every WS frame
// --------------------------------------------------------------------------- //

export function markToMarket(card: StudyCard, snap: ChainSnapshot): LiveMark | null {
  // Match each leg back to the current chain by strike + type + remaining DTE.
  const elapsedDays = Math.max(0, (snap.ts - card.entry_sim_ts) / 86400);
  const dteRemaining = Math.max(0, card.legs[0].entry_dte - elapsedDays);
  // Round to the nearest available DTE in the ladder (sim uses fixed tenors).
  const availDtes = Array.from(new Set(snap.quotes.map((q) => q.dte_days)));
  const nearestDte = availDtes.reduce((best, d) =>
    Math.abs(d - dteRemaining) < Math.abs(best - dteRemaining) ? d : best,
  );

  let markPer = 0;
  for (const leg of card.legs) {
    const match = snap.quotes.find(
      (q) => q.type === leg.type && q.dte_days === nearestDte && q.strike === leg.entry_strike,
    );
    if (!match) return null;
    markPer += leg.action === "long" ? match.mid : -match.mid;
  }
  const currentMid = markPer * 100;
  return {
    current_mid: currentMid,
    unrealized_pnl: currentMid - card.entry_debit,
    days_remaining: Math.round(dteRemaining),
  };
}

// --------------------------------------------------------------------------- //
// Closing — assigns dominant Greek and the deterministic lesson
// --------------------------------------------------------------------------- //

export function closeCard(
  card: StudyCard,
  snap: ChainSnapshot,
  reason: "user_closed" | "expired",
): StudyCard {
  const live = markToMarket(card, snap);
  const exitMid = live?.current_mid ?? card.entry_debit;
  const realized = exitMid - card.entry_debit;
  const exitIv = atmIv(snap, card.legs[0].entry_dte);

  // Very rough dominant-Greek attribution: which factor moved most?
  const spotMove = Math.abs((snap.spot - card.entry_spot) / card.entry_spot);
  const ivMove = exitIv != null && card.entry_iv != null
    ? Math.abs(exitIv - card.entry_iv)
    : 0;
  const timeFrac = Math.min(1, ((snap.ts - card.entry_sim_ts) / 86400) / card.legs[0].entry_dte);

  let dominant: StudyCardOutcome["dominant_greek"] = "delta";
  // Normalize the three axes so they're comparable.
  const scores: Record<StudyCardOutcome["dominant_greek"], number> = {
    delta: spotMove * 10,       // 10% spot move ≈ score 1
    vega: ivMove * 20,          // 0.05 IV move ≈ score 1
    theta: timeFrac,            // full time → score 1
    gamma: 0,                   // rolled into delta for this simple attribution
  };
  dominant = (Object.entries(scores) as [StudyCardOutcome["dominant_greek"], number][]).reduce(
    (best, cur) => (cur[1] > best[1] ? cur : best),
    ["delta", 0] as [StudyCardOutcome["dominant_greek"], number],
  )[0];

  const lesson = _lessonFor(card, realized, dominant, snap);

  return {
    ...card,
    status: "closed",
    outcome: {
      closed_at_sim_ts: snap.ts,
      exit_spot: snap.spot,
      exit_iv: exitIv,
      exit_regime: snap.regime,
      exit_mid: exitMid,
      realized_pnl: realized,
      reason,
      dominant_greek: dominant,
      lesson,
    },
  };
}

function _lessonFor(
  card: StudyCard,
  realized: number,
  dominant: StudyCardOutcome["dominant_greek"],
  snap: ChainSnapshot,
): string {
  const won = realized > 0;
  const dir = snap.spot > card.entry_spot ? "up" : snap.spot < card.entry_spot ? "down" : "flat";

  // Combine won/lost × dominant Greek into a specific teachable line.
  if (won) {
    if (dominant === "vega") {
      return `Vega dominated — implied vol moved in the direction this trade needed. This is the vol-mean-reversion mechanism working; note it wouldn't have worked without the IV move.`;
    }
    if (dominant === "delta") {
      return `Delta dominated — the underlying moved ${dir} enough to overwhelm time decay and any IV crush. Directional reads win when the move happens fast enough.`;
    }
    if (dominant === "theta") {
      return `Theta dominated — time value drained from the legs faster than adverse spot/vol moves could hurt. Classic short-premium outcome in a quiet regime.`;
    }
    return "Gamma-driven win — quick, sharp move around the strike drove the P&L before time or vega could offset it.";
  }
  // Lost.
  if (dominant === "vega") {
    return `Vega dominated — implied vol moved against this trade. Even a correctly-directional view loses when the vega component runs the wrong way (classic IV-crush loss).`;
  }
  if (dominant === "delta") {
    return `Delta dominated — the underlying moved ${dir} against the trade's view. The premium paid was the cost of being wrong on direction.`;
  }
  if (dominant === "theta") {
    return `Theta dominated — nothing happened fast enough, and time decay ate the premium. The trade needed a bigger move sooner.`;
  }
  return "Gamma-driven loss — sharp move around the strike hurt this trade before other factors could rescue it.";
}

// --------------------------------------------------------------------------- //
// ID generator — small enough to be readable, unique enough for a session
// --------------------------------------------------------------------------- //

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
