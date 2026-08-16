/**
 * Playbook copy — what each of the three desk personas typically watches
 * and typically does when a given anomaly kind fires. Different from
 * `personas.ts` (which carries concrete trade structures with strikes and
 * DTEs); this is the *conceptual* mental model.
 *
 * Every entry stays third-person: descriptions of what pros typically do,
 * never "you should" phrasing.
 */

import type { AnomalyKind } from "./types";

export type PersonaKey = "market_maker" | "directional_trader" | "vol_trader";

export interface PlaybookEntry {
  watching: string;   // what this persona is watching for
  reaction: string;   // how they typically react (mechanism, not instruction)
  risk: string;       // what they're risking with that reaction
}

export const PLAYBOOK: Record<AnomalyKind, Record<PersonaKey, PlaybookEntry>> = {
  iv_spike: {
    market_maker: {
      watching:
        "Whether the flow driving the spike is one-sided (all puts, all calls) or balanced. One-sided flow means the desk is accumulating inventory it needs to hedge.",
      reaction:
        "Quotes get wider on both sides to charge more for the increased risk. Every fill is delta-hedged into the underlying. Inventory is often laid off by selling into the elevated vol demand.",
      risk:
        "A violent spot move before the delta-hedge catches up; gamma losses if realized vol exceeds the vol the desk just sold.",
    },
    directional_trader: {
      watching:
        "What the underlying is doing while IV spikes. Rising IV with falling spot suggests fear; rising IV with flat spot often precedes news.",
      reaction:
        "Takes a direction view — bearish reads express through puts or put spreads (spreads reduce the IV cost). Bullish reads use call verticals for similar reasons.",
      risk:
        "The full option premium if the direction is wrong. IV crush post-event can hurt a correctly-directional trade if the move happens too late.",
    },
    vol_trader: {
      watching:
        "Whether the spike is out of line with realized volatility. When IV runs multiple standard deviations above realized, mean-reversion becomes the trade.",
      reaction:
        "Sells premium — typically defined-risk structures like iron condors so tail exposure is capped. Delta-hedges continuously to isolate the vol trade.",
      risk:
        "Realized vol continuing to exceed the sold IV; a regime change that keeps IV elevated for weeks rather than days.",
    },
  },
  pc_ratio_shift: {
    market_maker: {
      watching:
        "How the shift changes the desk's inventory. A put-heavy day means the desk has sold more puts than calls, leaving it net delta-short from that flow.",
      reaction:
        "Rebalances the underlying hedge continuously. Widens the busy side of the quote to slow further one-sided fills.",
      risk:
        "An adverse spot move before the hedge is complete — the desk is not betting on direction, but its book has one until the rebalance finishes.",
    },
    directional_trader: {
      watching:
        "Whether the shift is informed positioning (a leading indicator) or mechanical hedging (a lagging one). Cross-checks with news, IV, and cross-asset moves.",
      reaction:
        "Aligns with the flow using a defined-risk spread — a put spread if the read is bearish, a call spread if bullish. Sizes based on how confident the read is.",
      risk:
        "The debit paid on the spread if the pattern was noise; the pattern extending further than expected in the same direction (a spread caps upside).",
    },
    vol_trader: {
      watching:
        "Whether IV moved with the ratio. Only the pair (ratio shift + IV shift) is a vol signal — a ratio shift alone is a directional signal at best.",
      reaction:
        "If IV rose with the shift, sells premium via a short strangle. If IV stayed put, waits — the flow isn't a vol signal without confirmation.",
      risk:
        "A regime change that keeps IV elevated; a spot move that runs past the strangle's break-evens.",
    },
  },
  vol_oi_divergence: {
    market_maker: {
      watching:
        "Which strikes are seeing the divergence and how liquid they are. Concentrated flow on short-dated OTM strikes is the informed-positioning signature.",
      reaction:
        "Widens spreads aggressively at the affected strikes. In extreme cases, reduces inventory in the name outright rather than continue quoting into what looks like adverse selection.",
      risk:
        "Continued informed flow overwhelming the desk's hedging capacity before a catalyst prints — the classic 'we got picked off' scenario.",
    },
    directional_trader: {
      watching:
        "The direction of the new OI opening. When it's concentrated in calls, the flow is bullish; when in puts, bearish. Cross-references with any catalyst known to be near.",
      reaction:
        "Positions in the direction of the flow with defined risk — usually a vertical spread at the exact strikes seeing the new OI, matched DTE.",
      risk:
        "The debit paid if the flow turns out to be hedging rather than positioning; a catalyst that resolves inside the spread's strikes.",
    },
    vol_trader: {
      watching:
        "Whether IV has followed the divergence up yet. If IV hasn't reacted, long optionality is still cheap ahead of what looks like an approaching move.",
      reaction:
        "Buys long gamma and long vega — a long straddle or long calendar ahead of the expected realized-vol expansion.",
      risk:
        "The pattern resolving with no IV rise (informed hedging, not informed betting); IV crush if the position is still on when a scheduled catalyst resolves.",
    },
  },
};
